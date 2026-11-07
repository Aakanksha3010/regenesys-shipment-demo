import {test as nodeTest,after} from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
const results:{name:string;passed:boolean}[]=[];
function test(name:string,fn:()=>void|Promise<void>){nodeTest(name,async()=>{try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false});throw e;}});}
after(async()=>{await mkdir('validation',{recursive:true});await writeFile('validation/voice-results.json',JSON.stringify({tests:results},null,2));});
import assert from 'node:assert/strict';
import {voiceClarification,callerReply,classifyVoiceIntent} from '../src/voice-language.js';
import {voicePrompts} from '../src/voice-prompts.js';
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

test('video regression retains 3 p.m. and asks only for missing date and timezone',()=>{
 const text='expect the shipment to arrive at 3:00 p.m.';
 assert.equal(voiceClarification(text),'ask_date_timezone');
 assert.doesNotMatch(voicePrompts[voiceClarification(text)],/AM or PM|what time/i);
 const result=interpretVoice(text,'November 11, 2026 India Standard Time',sh);
 assert.equal(result.instant,'2026-11-11T09:30:00Z');assert.equal(result.tz,'Asia/Kolkata');
});
test('IST time survives a date-only clarification and is visibly defined as India',()=>{
 assert.equal(voiceClarification('3 PM IST'),'ask_date');
 const result=interpretVoice('3 PM IST','November eleventh, 2026',sh);
 assert.equal(result.instant,'2026-11-11T09:30:00Z');assert.equal(result.time,'15:00:00');
 assert.match(result.raw,/Got the time and time zone. What date/);
});
test('30-minute delay after a partial ETA escalates without calculating an invented 3:30 ETA',()=>{
 const result=interpretVoice('3 PM IST','There is a 30-minute delay',sh);
 assert.equal(result.instant,null);assert.equal(result.voiceIntent,'delay_report');assert.equal(result.assessment,'delay');assert.ok(result.reasons.includes('delay_reported'));
 assert.equal(callerReply(result),'delay_handoff');
});
test('reported five-hour delay immediately offers human help without inventing a date or ETA',()=>{
 const first="we'll be arriving five hours late from today's time";
 const followup="right now it's three, so I'm gonna be arriving five hours late from the estimate. And the time zone is same as yours";
 for(const [answer,clarification] of [[first,undefined],[first,followup],[followup,undefined],["Today right now it's 3 PM Central time; we'll arrive five hours late from the estimate",undefined]]){
  const result=interpretVoice(answer!,clarification,sh);
  assert.equal(result.voiceIntent,'delay_report');assert.equal(result.instant,null);assert.equal(result.date,undefined);assert.equal(result.time,undefined);assert.equal(result.tz,undefined);
  assert.equal(result.capture,'uncaptured');assert.equal(result.assessment,'delay');assert.ok(result.reasons.includes('delay_reported'));
  assert.equal(callerReply(result),'delay_handoff');
 }
 assert.equal(voiceClarification(first),'delay_handoff');
 assert.match(voicePrompts.delay_handoff,/sorry.*human coordinator.*simulated handoff/i);
 assert.doesNotMatch(voicePrompts.delay_handoff,/got the date|connected|transfer successful/i);
 const s=transition(seed(),{...action,text:first},localActor);
 assert.equal(s.reports[0].instant,null);assert.equal(s.escalations.length,1);assert.equal(s.escalations[0].reasons[0].reason,'delay_reported');
});
test('duration-based lateness supports hours and minutes without treating negated lateness as a delay',()=>{
 for(const answer of ['We are 5 hours late','Arriving five-hours late','We are two hrs late','Arriving fifteen minutes late'])assert.equal(interpretVoice(answer,undefined,sh).delay,true);
 for(const answer of ['We are not five hours late','We are not 30 minutes late','We are not running late'])assert.equal(interpretVoice(answer,undefined,sh).delay,false);
 assert.equal(interpretVoice("Today right now it's 3 PM Central time",undefined,sh).instant,null);
 assert.equal(voiceClarification("Today right now it's 3 PM Central time"),'clarification');
});
test('human requests and frustration receive empathy and a human queue reason without suppressing contact',()=>{
 for(const text of ['I want to speak to a human','I already told you, stop asking, this is frustrating']){
  const result=interpretVoice(text,undefined,sh);assert.ok(result.reasons.some(r=>['human_requested','caller_frustrated'].includes(r)));
  assert.equal(callerReply(result),text.includes('frustrating')?'empathy_handoff':'human_handoff');
  const s=transition(seed(),{...action,text},localActor);assert.equal(s.contacts[0].suppressed,false);assert.equal(s.escalations.length,1);
 }
});
test('caller prompts stay shipment-focused and never expose coordinator review or backend details',()=>{
 for(const key of ['intro','preview','review','escalation','delay_handoff','empathy_handoff','human_handoff'] as const){
  assert.doesNotMatch(voicePrompts[key],/\b(?:transcript|backend|database|save|review|cleanliness|healthy|happy life)\b/i);
 }
 assert.equal(voicePrompts.preview,voicePrompts.intro);
 assert.equal(classifyVoiceIntent("I'm not frustrated and don't need a human").frustrated,false);
 assert.equal(classifyVoiceIntent("I don't need a human").humanRequested,false);
 assert.equal(interpretVoice('No delay. November 11, 2026 at 3 PM Central time',undefined,sh).delay,false);
});
