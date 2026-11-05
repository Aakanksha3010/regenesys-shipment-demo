import {test as nodeTest,after} from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
const results:{name:string;passed:boolean}[]=[];
function test(name:string,fn:()=>void|Promise<void>){nodeTest(name,async()=>{try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false});throw e;}});}
after(async()=>{await mkdir('validation',{recursive:true});await writeFile('validation/voice-results.json',JSON.stringify({tests:results},null,2));});
import assert from 'node:assert/strict';
import {seed,transition,interpretVoice,localActor} from '../src/domain.js';
import {localStore} from '../server/store.js';
const sh=seed().shipments[0];
const text='November eleventh, 2026 at three thirty PM Central Standard Time';
const action={type:'voice_demo',requestId:'voice-one',expectedVersion:0,shipmentId:sh.id,text,reviewed:true,inputMethod:'browser_voice'};
test('voice normalizes spoken dates and times without inventing missing fields',()=>{
 assert.equal(interpretVoice(text,undefined,sh).instant,'2026-11-11T21:30:00Z');
 assert.equal(interpretVoice('tomorrow at three PM',undefined,sh).capture,'uncaptured');
 assert.equal(interpretVoice('tomorrow at three PM','Central time',sh).instant,'2026-11-11T21:00:00Z');
});
test('voice does not confirm tentative estimates or conflicting times',()=>{
 for(const answer of ['Maybe tomorrow at three PM Central time','November 11, 2026 at 3 PM and 5 PM Central time','Between 2 and 4 PM Central time tomorrow'])assert.equal(interpretVoice(answer,undefined,sh).capture,'uncaptured');
});
test('delay in clarification remains a mandatory escalation',()=>{
 const r=interpretVoice('tomorrow at 3 PM','We broke down, not sure when',sh);
 assert.equal(r.capture,'uncaptured');assert.equal(r.assessment,'delay');assert.ok(r.reasons.includes('delay_reported'));
});
test('voice detects wrong numbers, refusal, voicemail and explicit no answer',()=>{
 for(const [answer,outcome] of [['Wrong number','wrong_number'],["I cannot share the ETA",'refused'],['Leave a message','voicemail'],['[No response heard]','no_answer']]){
  const r=interpretVoice(answer,undefined,sh);assert.equal(r.outcome,outcome);assert.equal(r.capture,'uncaptured');assert.ok(r.reasons.length);
 }
});
test('review is required and browser cannot supply trusted interpretation',()=>{
 assert.throws(()=>transition(seed(),{...action,reviewed:false},localActor),/Review/);
 const s=transition(seed(),{...action,text:'not sure',instant:'2026-11-11T21:00:00Z',capture:'captured'},localActor);
 assert.equal(s.reports[0].capture,'uncaptured');assert.equal(s.escalations.length,1);
});
test('reviewed voice creates one atomic, idempotent check with provenance',()=>{
 const s=transition(seed(),{...action,heard:'Carrier: '+text},localActor);
 assert.equal(s.version,1);assert.equal(s.checks.length,1);assert.equal(s.checks[0].status,'finished');
 assert.equal(s.attempts[0].inputMethod,'browser_voice');assert.equal(s.reports[0].raw,text);
 assert.equal(s.audit.at(-1)?.action,'voice_demo_reviewed');assert.deepEqual(transition(s,action,localActor),s);
});
test('voice refusal suppresses contact and blocks subsequent checks',()=>{
 const s=transition(seed(),{...action,text:"Don't call me"},localActor);
 assert.equal(s.contacts[0].suppressed,true);
 assert.throws(()=>transition(s,{...action,requestId:'second',expectedVersion:s.version},localActor),/suppressed/);
});
test('voice submission respects active checks, retirement and viewer permissions',()=>{
 const s=transition(seed(),{type:'request',shipmentId:sh.id,requestId:'existing'},localActor);
 assert.throws(()=>transition(s,{...action,expectedVersion:s.version},localActor),/already active/);
 assert.throws(()=>transition(seed(),action,{...localActor,role:'viewer'}),/Read-only/);
 const retired=transition(seed(),{type:'retire',shipmentId:sh.id,requestId:'retire',reason:'test'},localActor);
 assert.throws(()=>transition(retired,{...action,expectedVersion:retired.version},localActor),/Retired/);
});
test('voice check persists with existing database constraints and original transcript',async()=>{
 const {store,db}=await localStore();try{
 const s=await store.dispatch(action,localActor);
 assert.equal((await store.read()).reports[0].raw,text);
 assert.equal(s.reports[0].instant,'2026-11-11T21:30:00Z');
 const r=await db.query<{method:string}>("select data->>'inputMethod' as method from shipment_demo.attempts");assert.equal(r.rows[0].method,'browser_voice');
 }finally{await db.close();}
});

test('voice draft cannot overwrite changes made while the conversation was open',()=>{const s=transition(seed(),{type:'correct',requestId:'human',shipmentId:sh.id,localTime:'2026-11-11T16:00',timezone:'America/Chicago',reason:'Human update'},localActor);assert.throws(()=>transition(s,action,localActor),/workspace changed/);});
