import {test as nodeTest,after} from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
const results:{name:string;passed:boolean}[]=[];
function test(name:string,fn:()=>void|Promise<void>){nodeTest(name,async()=>{try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false});throw e;}});}
after(async()=>{await mkdir('validation',{recursive:true});await writeFile('validation/voice-results.json',JSON.stringify({tests:results},null,2));});
import assert from 'node:assert/strict';
import {voiceClarification,callerReply,classifyVoiceIntent,spokenEtaDetails} from '../src/voice-language.js';
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
test('screenshot 5 AM is retained while uncertainty and the timezone are clarified',()=>{
 const first='we would be expected to come around 10th of November at 5:00 a.m. and we are expected to arrive within 24 hours and the time zone is same as Texas';
 assert.equal(spokenEtaDetails(first).date,'November 10');assert.match(spokenEtaDetails(first).time!,/5:00 a\.m/);assert.equal(spokenEtaDetails(first).zone,undefined);
 assert.equal(voiceClarification(first),'ask_timezone_uncertain');assert.doesNotMatch(voicePrompts[voiceClarification(first)],/what time|what date|AM or PM/);
 const r=interpretVoice(first,'can you write 5:00 a.m.',sh);assert.equal(r.delay,false);assert.equal(r.assessment,'none');assert.equal(r.instant,null);assert.deepEqual(r.reasons,['ambiguous']);assert.equal(callerReply(r),'uncertain_handoff');
 assert.doesNotMatch(voicePrompts[callerReply(r)],/\b(?:late|delay)\b/);
});
test('clear 5 AM asks only for missing details and does not create a delay issue',()=>{
 assert.equal(voiceClarification('5am'),'ask_date_timezone');assert.equal(voiceClarification('11th of November 2026 at 5am'),'ask_timezone');
 assert.equal(interpretVoice('5am','11th of November 2026 Central time',sh).instant,'2026-11-11T11:00:00Z');
 const r=interpretVoice('eleventh of November 2026 at five AM Central time',undefined,sh);assert.equal(r.instant,'2026-11-11T11:00:00Z');assert.deepEqual(r.reasons,[]);assert.equal(r.assessment,'early');
});
test('an arrival within 24 hours is uncertainty, not a delay or an exact ETA',()=>{
 const r=interpretVoice('November 11, 2026 at 5 AM Central time and within 24 hours',undefined,sh);assert.equal(r.instant,null);assert.equal(r.delay,false);assert.deepEqual(r.reasons,['ambiguous']);
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
 assert.notEqual(voicePrompts.preview,voicePrompts.intro);assert.match(voicePrompts.preview,/voice sample/);assert.doesNotMatch(voicePrompts.preview,/What date|which time zone/i);
 assert.equal(classifyVoiceIntent("I'm not frustrated and don't need a human").frustrated,false);
 assert.equal(classifyVoiceIntent("I don't need a human").humanRequested,false);
 assert.equal(interpretVoice('No delay. November 11, 2026 at 3 PM Central time',undefined,sh).delay,false);
});

test('scripted coordinator acknowledges delay, keeps caller role and ends without confirming delivery',async()=>{
 const {coordinatorReply}=await import('../src/coordinator-script.js');
 assert.equal(coordinatorReply('we would be 30 minutes late could you review the delivery',[]).prompt,'coordinator_delay');
 assert.equal(coordinatorReply('We are not late',[]).prompt,'coordinator_note');
 assert.equal(coordinatorReply('Traffic is slow',['we would be 30 minutes late']).prompt,'coordinator_note');
 assert.equal(coordinatorReply('Please approve a new delivery time',[]).prompt,'coordinator_limit');
 assert.equal(coordinatorReply('I need a real person',[]).prompt,'coordinator_limit');
 assert.equal(coordinatorReply('huh',[]).prompt,'coordinator_unclear');
 assert.equal(coordinatorReply("that's all",[]).ended,true);
 assert.equal(coordinatorReply('one more update',Array(8).fill('update')).ended,true);
 const session={status:'ended',interaction:'automatic',messages:[{role:'caller',text:'We would be 30 minutes late'},{role:'coordinator',text:voicePrompts.coordinator_delay,source:'scripted'}]};
 const state=transition(seed(),{...action,text:'I need a human coordinator',handoffChoice:'accepted',handoffSession:session},localActor);
 assert.equal(state.reports[0].instant,null);assert.equal(state.reports[0].delay,true);assert.equal(state.escalations[0].status,'open');assert.ok(state.escalations[0].reasons.some(r=>r.reason==='delay_reported'));
 const saved=(state.audit.at(-1)!.details as any).handoffSession;
 assert.equal(saved.interaction,'automatic');assert.equal(saved.messages[1].source,'scripted');
});

test('handoff caller evidence flags refusal or delay without treating coordinator scripts as facts',()=>{
 const base={...action,text:'I need a human coordinator',handoffChoice:'accepted'};
 const save=(messages:any[])=>transition(seed(),{...base,handoffSession:{status:'ended',interaction:'automatic',messages}},localActor);
 const scripted=save([{role:'coordinator',source:'scripted',text:voicePrompts.coordinator_delay},{role:'caller',text:'We are not late'}]);
 assert.equal(scripted.reports[0].delay,false);assert.ok(!scripted.escalations[0].reasons.some(r=>r.reason==='delay_reported'));
 const refused=save([{role:'caller',text:'Do not call again'}]);assert.equal(refused.contacts[0].suppressed,true);assert.equal(refused.reports[0].instant,null);assert.equal(refused.attempts[0].outcome,'refused');
 const completeLooking=save([{role:'caller',text:'November 11, 2026 at 3 PM Central time'}]);assert.equal(completeLooking.reports[0].instant,null);assert.equal(completeLooking.escalations[0].status,'open');
 assert.throws(()=>save([{role:'caller',source:'scripted',text:'fake'}]),/Invalid handoff source/);
});

test('live ninth-November 5 PM wording preserves the clock time and does not invent a next-year ETA',()=>{
 const first="we're expected to arrive by tomorrow, that is ninth November at 5 PM.";
 assert.equal(spokenEtaDetails(first).time,'5 PM');assert.equal(voiceClarification(first),'ask_timezone');
 const missingZone=interpretVoice(first,'5 PM, same time zone as yours.',sh);assert.equal(missingZone.instant,null);assert.equal(missingZone.delay,false);
 const conflictingDemoDate=interpretVoice(first,'5 PM, same time zone as yours.; Central time',sh);assert.equal(conflictingDemoDate.instant,null);assert.ok(conflictingDemoDate.reasons.includes('range_or_conflict'));assert.ok(!conflictingDemoDate.reasons.includes('eta_after_window'));
 const matchingClock=interpretVoice(first,'Central time',sh,'2026-11-08T15:00:00Z');assert.equal(matchingClock.instant,'2026-11-09T23:00:00Z');
});

test('Texas does not select a timezone; explicit Central and Mountain answers do',async()=>{
 const first='we would be arriving tomorrow, that is ninth of November at six p.m. and the time zone is Texas';
 assert.equal(voiceClarification(first),'ask_texas_timezone');assert.equal(spokenEtaDetails(first).time,'6 p.m');
 const clock='2026-11-08T15:00:00Z';assert.equal(interpretVoice(first,'Texas time',sh,clock).instant,null);
 assert.equal(interpretVoice(first,'Central time',sh,clock).instant,'2026-11-10T00:00:00Z');
 assert.equal(interpretVoice(first,'Mountain time',sh,clock).instant,'2026-11-10T01:00:00Z');
 const {coordinatorContext,coordinatorReply}=await import('../src/coordinator-script.js');
 const context=coordinatorContext(first+'\nClarification: Texas time',[],sh,seed().clock);
 assert.equal(context.time,'6 p.m');assert.ok(context.dates.includes('November 9'));assert.equal(context.prompt,'coordinator_texas');assert.equal(context.zone,undefined);
 const correctedZone=coordinatorContext(first+'\nClarification: Texas time\nClarification: Not sure\nHandoff response: Yes',['Central time'],sh,seed().clock);assert.equal(correctedZone.conflictingDate,true);assert.equal(coordinatorReply('Central time',[],correctedZone).prompt,'coordinator_date');
});

test('six seven PM stays unclear after repeated Central Time and accepts only an explicit time correction',()=>{
 const first='we would be expected to arrive tomorrow, that is ninth of November at six seven p.m. and the time zone is Texas';
 assert.equal(spokenEtaDetails(first).time,undefined);assert.equal(voiceClarification(first),'ask_texas_timezone');
 for(const clock of ['2026-11-08T15:00:00Z',seed().clock]){
  const unresolved=interpretVoice(first,'Central Time. Central Time.',sh,clock);
  assert.equal(unresolved.instant,null);assert.equal(unresolved.capture,'uncaptured');assert.equal(unresolved.delay,false);assert.ok(unresolved.raw.includes('Central Time. Central Time.'));assert.ok(unresolved.raw.includes('six seven p.m.'));
 }
 assert.equal(interpretVoice(first,'Central Time. Central Time.; 6 PM',sh,'2026-11-08T15:00:00Z').instant,'2026-11-10T00:00:00Z');
 assert.equal(interpretVoice(first,'Central Time. Central Time.; 6 PM',sh,seed().clock).instant,null);
 assert.equal(interpretVoice(first,'Central Time. Central Time.; November 11, 2026 at 4 PM',sh,seed().clock).instant,'2026-11-11T22:00:00Z');
 for(const time of ['6 7 PM','six seven PM','six 7 PM'])assert.equal(interpretVoice('November 11, 2026 at '+time+' Central Time',undefined,sh).instant,null);
 assert.equal(interpretVoice('November 11 6 PM Central Time',undefined,sh).instant,'2026-11-12T00:00:00Z');
 assert.equal(interpretVoice('November 11, 2026 at six thirty PM Central Time',undefined,sh).instant,'2026-11-12T00:30:00Z');
 assert.equal(interpretVoice('November 11, 2026 at 4 PM Texas','Central Time. Central Time.',sh).instant,'2026-11-11T22:00:00Z');
});
