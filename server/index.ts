import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { localStore,hostedStore } from './store.js';
import { localActor,scenarios,type Actor } from '../src/domain.js';
import {createVoiceService,VoiceError} from './voice.js';
import {authorize} from './access.js';
import {localAudio,hostedAudio,recordingPermission,validateAudio,metadata,audioRecords,findPlayable,purgeAudio,type AudioStorage} from './audio.js';
const voice=createVoiceService(process.env.ELEVENLABS_API_KEY);
const port=Number(process.env.PORT||4173);
const hosted=process.env.DATA_MODE==='supabase';
if(hosted&&(!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY||!process.env.SUPABASE_PUBLISHABLE_KEY))throw Error('Supabase mode requires URL, publishable key and server-only secret key. No silent local fallback.');
await mkdir('.data',{recursive:true});
const persistence=hosted?await hostedStore(process.env.SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!):await localStore(process.env.LOCAL_DATA_PATH||'.data/postgres');
const store=persistence.store;
let audioStorage:AudioStorage|null=null;
if(process.env.AUDIO_HISTORY_ENABLED==='true')try{audioStorage='client' in persistence?await hostedAudio(persistence.client):await localAudio((process.env.LOCAL_DATA_PATH||'.data/postgres')+'-audio');}catch{console.warn('Audio history disabled: private storage is not available.');}
if(audioStorage){const run=async()=>{try{await purgeAudio(audioStorage!,await store.read());}catch{console.warn('Audio cleanup failed; expired recordings remain blocked from playback.');}};await run();setInterval(run,3600000).unref();}
const publicAuth=hosted?createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'64kb'}));
app.use('/api',(req,res,next)=>{
 const origin=req.headers.origin;
 if(origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(origin)){res.status(403).json({error:'Origin not allowed.'});return;}
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host||'')){res.status(403).json({error:'Host not allowed.'});return;}next();
});
app.get('/api/config',(_req,res)=>res.json({mode:hosted?'supabase':'local',supabaseUrl:hosted?process.env.SUPABASE_URL:undefined,publishableKey:hosted?process.env.SUPABASE_PUBLISHABLE_KEY:undefined,audioHistory:!!audioStorage,scenarios}));
app.use('/api',async(req,res,next)=>{try{
 let actor:Actor=localActor;
 if(hosted){const client=('client' in persistence)?persistence.client:null;actor=await authorize(req.headers.authorization?.replace(/^Bearer /,''),async token=>{const {data,error}=await publicAuth!.auth.getUser(token);return error?null:data.user;},async id=>{const {data,error}=await client!.rpc('shipment_demo_role',{p_user_id:id});return error?null:data;});}
 res.locals.actor=actor;next();
 }catch(e){res.status(401).json({error:(e as Error).message});}});
app.get('/api/state',async(_req,res)=>{try{res.json({state:await store.read(),actor:res.locals.actor});}catch(e){res.status(500).json({error:(e as Error).message});}});
app.post('/api/recordings/:attemptId',express.raw({type:['audio/webm','audio/mp4','audio/ogg'],limit:'10mb'}),async(req,res)=>{let savedId:string|undefined;try{
 if(!audioStorage)throw Error('Audio history is not enabled.');
 const current=await store.read(),attempt=recordingPermission(current,String(req.params.attemptId),res.locals.actor,req.headers['x-recording-consent']);
 const existing=audioRecords(current).find(r=>r.attemptId===attempt.id);if(existing){res.json({state:current});return;}
 const bytes=req.body,mime=req.headers['content-type']||'';if(!Buffer.isBuffer(bytes))throw Error('Audio upload required.');validateAudio(bytes,mime);
 const recording=metadata(attempt,mime,String(req.headers['x-recording-coverage']||''));await audioStorage.put(recording.id,bytes,mime);savedId=recording.id;
 const state=await store.dispatch({type:'attach_audio',requestId:'audio:'+attempt.id,shipmentId:attempt.shipmentId,recording},res.locals.actor);
 if(!audioRecords(state).some(r=>r.id===recording.id))await audioStorage.remove([recording.id]);savedId=undefined;res.json({state});
 }catch(e){if(savedId)await audioStorage?.remove([savedId]).catch(()=>{});res.status(400).json({error:(e as Error).message});}});
app.get('/api/recordings/:id',async(req,res)=>{try{if(!audioStorage)throw Error('Audio history is not enabled.');const record=findPlayable(await store.read(),String(req.params.id));const bytes=await audioStorage.get(record.id);res.set({'Content-Type':record.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}).send(bytes);}catch(e){res.status(404).json({error:(e as Error).message});}});
app.use('/api/voice',(_req,res,next)=>{if(res.locals.actor.role!=='coordinator'){res.status(403).json({error:'Only coordinators can use the voice demo.'});return;}next();});
app.get('/api/voice/options',async(_req,res)=>{try{res.json({configured:voice.configured,voices:voice.configured?await voice.list():[]});}catch(e){res.status(e instanceof VoiceError?e.status:503).json({error:e instanceof VoiceError?e.message:'Voice service unavailable.'});}});
app.post('/api/voice/speech',async(req,res)=>{try{const audio=await voice.speak(req.body.prompt,req.body.voiceId);res.set({'Content-Type':'audio/mpeg','Cache-Control':'no-store'}).send(audio);}catch(e){res.status(e instanceof VoiceError?e.status:503).json({error:e instanceof VoiceError?e.message:'Voice service unavailable.'});}});
app.post('/api/actions',async(req,res)=>{try{
 const action=req.body;if(!action||typeof action.type!=='string'||typeof action.requestId!=='string')throw Error('Invalid action.');
 // Provider events are internal. Browser voice submissions use the reviewed voice_demo command.
 if(['event','attach_audio'].includes(action.type))throw Error('This action must use its authorized server route.');
 const state=await store.dispatch(action,res.locals.actor);res.json({state});
 }catch(e){res.status(400).json({error:(e as Error).message});}});
app.post('/api/reset',async(req,res)=>{if(hosted){res.status(403).json({error:'Hosted reset is disabled to preserve history. Use fictional new shipments.'});return;}if(req.body.confirm!=='RESET DEMO'){res.status(400).json({error:'Type RESET DEMO to reset.'});return;}
 // Reset only the isolated local snapshot, in one transaction; never touches another schema.
 if('db' in persistence){await persistence.db.transaction(async tx=>{await tx.exec('truncate shipment_demo.snapshot, shipment_demo.contacts, shipment_demo.shipments, shipment_demo.checks, shipment_demo.attempts, shipment_demo.reports, shipment_demo.escalations, shipment_demo.events, shipment_demo.audit, shipment_demo.annotations, shipment_demo.suppression_events cascade');const {seed}=await import('../src/domain.js');await tx.query('select public.shipment_demo_save(-1,$1::jsonb)',[JSON.stringify(seed())]);});}
 res.json({state:await store.read()});});
if(existsSync('dist/index.html')&&process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));}else{const vite=await createViteServer({server:{middlewareMode:true,hmr:{port:port+100}},appType:'spa'});app.use(vite.middlewares);}
app.listen(port,'127.0.0.1',()=>console.log(`Regenesys demo: http://127.0.0.1:${port} (${hosted?'Supabase Auth':'LOCAL · simulated identity'})`));
