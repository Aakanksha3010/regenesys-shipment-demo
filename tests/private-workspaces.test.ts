import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createApp} from '../server/app.js';
import {seed,transition} from '../src/domain.js';

test('hosted API isolates account state, writes, audit and audio using the verified session',async()=>{
 const db=new PGlite(),alice='00000000-0000-0000-0000-000000000001',bob='00000000-0000-0000-0000-000000000002';
 await db.exec('create role service_role bypassrls; create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text);');
 await db.exec(await readFile('supabase/migrations/20261105205752_shipment_demo.sql','utf8'));
 await db.query('insert into auth.users values($1,$2),($3,$4)',[alice,'aakankshagyan3010@gmail.com',bob,'bob@example.test']);
 await db.query("insert into shipment_demo.members values($1,'coordinator'),($2,'coordinator')",[alice,bob]);
 const original=transition(seed(),{type:'annotate',requestId:'legacy-note',shipmentId:'shipment-1',text:'Owner private history'},{id:alice,name:'Alice',role:'coordinator'});
 original.audit.push({id:'audio-audit',entityId:'old-attempt',action:'conversation_audio_saved',actorId:alice,actorName:'Alice',actorType:'human',at:new Date().toISOString(),details:{recording:{id:'owner-recording',attemptId:'old-attempt',shipmentId:'shipment-1',mime:'audio/webm',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),coverage:'microphone_and_bella',consent:true}}});
 await db.query('select public.shipment_demo_save(-1,$1::jsonb)',[JSON.stringify({...original,version:0})]);
 await db.exec(await readFile('supabase/migrations/20261110061321_private_account_workspaces.sql','utf8'));
 const stub=createServer(async(req,res)=>{try{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/auth/v1/user'){const id=req.headers.authorization==='Bearer alice'?alice:req.headers.authorization==='Bearer bob'?bob:null;res.statusCode=id?200:401;res.end(JSON.stringify(id?{id,email:id===alice?'alice@example.test':'bob@example.test'}:{message:'Invalid token'}));return;}
  if(req.url?.startsWith('/storage/v1/bucket/')){res.end(JSON.stringify({id:'shipment-demo-audio',name:'shipment-demo-audio',public:false}));return;}
  if(req.url?.startsWith('/storage/v1/object/list/')){res.end('[]');return;}
  if(req.url?.includes('/storage/v1/object/')&&req.url.endsWith('/owner-recording')){res.setHeader('Content-Type','audio/webm');res.end(Buffer.from([0x1a,0x45,0xdf,0xa3]));return;}
  let raw='';for await(const c of req)raw+=c;const p=raw?JSON.parse(raw):{};const fn=req.url?.split('/').at(-1);
  const sql=fn==='shipment_demo_role'?['select public.shipment_demo_role($1) as result',[p.p_user_id]]:fn==='shipment_account_read'?['select public.shipment_account_read($1) as result',[p.p_user_id]]:fn==='shipment_account_save'?['select public.shipment_account_save($1,$2,$3::jsonb) as result',[p.p_user_id,p.p_expected,JSON.stringify(p.p_state)]]:null;
  if(fn==='shipment_account_audio_audit'){const r=await db.query<{result:unknown}>('select public.shipment_account_audio_audit() as result');res.end(JSON.stringify(r.rows[0].result));return;}
  if(!sql)throw Error('Unexpected RPC '+fn);
  const r=await db.query<{result:unknown}>(sql[0] as string,sql[1] as any[]);res.end(JSON.stringify(r.rows[0]?.result??null));
 }catch(e){res.statusCode=400;res.end(JSON.stringify({message:String(e)}));}});
 await new Promise<void>(r=>stub.listen(0,'127.0.0.1',r));
 const keys=['DATA_MODE','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY','AUDIO_HISTORY_ENABLED','VERCEL','PORT'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.DATA_MODE='supabase';process.env.SUPABASE_URL=`http://127.0.0.1:${(stub.address() as any).port}`;process.env.SUPABASE_SECRET_KEY='test-service-key';process.env.SUPABASE_PUBLISHABLE_KEY='test-public-key';process.env.AUDIO_HISTORY_ENABLED='true';delete process.env.VERCEL;process.env.PORT='4173';
 let server:ReturnType<ReturnType<typeof createServer>['listen']>|undefined;
 try{
  server=createServer();server.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.once('listening',r));process.env.PORT=String((server.address() as any).port);const {app}=await createApp();server.on('request',app);const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const api=async(token:string,path='state',body?:unknown)=>{const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
  const a=await api('alice'),b=await api('bob');assert.equal(a.status,200);assert.ok(a.data.state.audit.some((x:any)=>x.actorId===alice));assert.equal(b.data.state.audit.length,0);
  await api('bob','actions',{type:'annotate',requestId:'bob-only',shipmentId:'shipment-1',text:'Bob private note',userId:alice,workspaceId:alice});
  assert.equal((await api('alice')).data.state.annotations.some((x:any)=>x.text==='Bob private note'),false);
  assert.equal((await api('bob')).data.state.annotations.some((x:any)=>x.text==='Bob private note'),true);
  assert.equal((await api('bob','state?userId='+alice)).data.state.audit.some((x:any)=>x.actorId===alice),false);
  assert.equal((await api('invalid')).status,401);
  assert.equal((await fetch(base+'/api/recordings/owner-recording',{headers:{Authorization:'Bearer alice'}})).status,200);
  assert.equal((await api('bob','recordings/owner-recording')).status,404);
  assert.equal((await db.query<{a:any[]}>('select public.shipment_account_audio_audit() as a')).rows[0].a.length,1);
  for(const role of ['anon','authenticated']){const r=await db.query<{ok:boolean}>("select has_function_privilege($1,'public.shipment_account_read(uuid)','execute') as ok",[role]);assert.equal(r.rows[0].ok,false);}
  assert.equal((await db.query<{ok:boolean}>("select has_function_privilege('service_role','public.shipment_demo_read()','execute') as ok")).rows[0].ok,false);
  const preserved=await db.query<{state:unknown}>('select state from shipment_demo.snapshot');assert.deepEqual(preserved.rows[0].state,{...original,version:0});
 }finally{await new Promise<void>(r=>server?server.close(()=>r()):r());await new Promise<void>(r=>stub.close(()=>r()));await db.close();for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
