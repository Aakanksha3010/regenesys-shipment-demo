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
const voice=createVoiceService(process.env.ELEVENLABS_API_KEY);
const port=Number(process.env.PORT||4173);
const hosted=process.env.DATA_MODE==='supabase';
if(hosted&&(!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY||!process.env.SUPABASE_PUBLISHABLE_KEY))throw Error('Supabase mode requires URL, publishable key and server-only secret key. No silent local fallback.');
await mkdir('.data',{recursive:true});
const persistence=hosted?await hostedStore(process.env.SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!):await localStore(process.env.LOCAL_DATA_PATH||'.data/postgres');
const store=persistence.store;
const publicAuth=hosted?createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'32kb'}));
app.use('/api',(req,res,next)=>{
 const origin=req.headers.origin;
 if(origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(origin)){res.status(403).json({error:'Origin not allowed.'});return;}
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host||'')){res.status(403).json({error:'Host not allowed.'});return;}next();
});
app.get('/api/config',(_req,res)=>res.json({mode:hosted?'supabase':'local',supabaseUrl:hosted?process.env.SUPABASE_URL:undefined,publishableKey:hosted?process.env.SUPABASE_PUBLISHABLE_KEY:undefined,scenarios}));
app.use('/api',async(req,res,next)=>{try{
 let actor:Actor=localActor;
 if(hosted){const token=req.headers.authorization?.replace(/^Bearer /,'');if(!token)throw Error('Sign in to continue.');const {data,error}=await publicAuth!.auth.getUser(token);if(error||!data.user)throw Error('Session expired. Sign in again.');const client=('client' in persistence)?persistence.client:null;const role=await client!.rpc('shipment_demo_role',{p_user_id:data.user.id});if(role.error||!['coordinator','viewer'].includes(role.data))throw Error('Your account has not been assigned a demo role.');actor={id:data.user.id,name:data.user.email||'Coordinator',role:role.data};}
 res.locals.actor=actor;next();
 }catch(e){res.status(401).json({error:(e as Error).message});}});
app.get('/api/state',async(_req,res)=>{try{res.json({state:await store.read(),actor:res.locals.actor});}catch(e){res.status(500).json({error:(e as Error).message});}});
app.use('/api/voice',(_req,res,next)=>{if(res.locals.actor.role!=='coordinator'){res.status(403).json({error:'Only coordinators can use the voice demo.'});return;}next();});
app.get('/api/voice/options',async(_req,res)=>{try{res.json({configured:voice.configured,voices:voice.configured?await voice.list():[]});}catch(e){res.status(e instanceof VoiceError?e.status:503).json({error:e instanceof VoiceError?e.message:'Voice service unavailable.'});}});
app.post('/api/voice/speech',async(req,res)=>{try{const audio=await voice.speak(req.body.prompt,req.body.voiceId);res.set({'Content-Type':'audio/mpeg','Cache-Control':'no-store'}).send(audio);}catch(e){res.status(e instanceof VoiceError?e.status:503).json({error:e instanceof VoiceError?e.message:'Voice service unavailable.'});}});
app.post('/api/actions',async(req,res)=>{try{
 const action=req.body;if(!action||typeof action.type!=='string'||typeof action.requestId!=='string')throw Error('Invalid action.');
 // Provider events are internal. Browser voice submissions use the reviewed voice_demo command.
 if(action.type==='event')throw Error('Provider events cannot be submitted by the browser.');
 const state=await store.dispatch(action,res.locals.actor);res.json({state});
 }catch(e){res.status(400).json({error:(e as Error).message});}});
app.post('/api/reset',async(req,res)=>{if(hosted){res.status(403).json({error:'Hosted reset is disabled to preserve history. Use fictional new shipments.'});return;}if(req.body.confirm!=='RESET DEMO'){res.status(400).json({error:'Type RESET DEMO to reset.'});return;}
 // Reset only the isolated local snapshot, in one transaction; never touches another schema.
 if('db' in persistence){await persistence.db.transaction(async tx=>{await tx.exec('truncate shipment_demo.snapshot, shipment_demo.contacts, shipment_demo.shipments, shipment_demo.checks, shipment_demo.attempts, shipment_demo.reports, shipment_demo.escalations, shipment_demo.events, shipment_demo.audit, shipment_demo.annotations, shipment_demo.suppression_events cascade');const {seed}=await import('../src/domain.js');await tx.query('select public.shipment_demo_save(-1,$1::jsonb)',[JSON.stringify(seed())]);});}
 res.json({state:await store.read()});});
if(existsSync('dist/index.html')&&process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));}else{const vite=await createViteServer({server:{middlewareMode:true,hmr:{port:port+100}},appType:'spa'});app.use(vite.middlewares);}
app.listen(port,'127.0.0.1',()=>console.log(`Regenesys demo: http://127.0.0.1:${port} (${hosted?'Supabase Auth':'LOCAL · simulated identity'})`));
