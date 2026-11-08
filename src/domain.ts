import { Temporal } from '@js-temporal/polyfill';
import {voicePrompts} from './voice-prompts.js';
import {normalizeSpeech,voiceEnding,uncertainSpeech,hasArrivalWindow,hasDelayEvidence,hasUnresolvedTimeReference,voiceClarification,classifyVoiceIntent} from './voice-language.js';

export type Assessment = 'none'|'on_time'|'early'|'delay';
export type Outcome = 'eta_captured'|'eta_incomplete'|'ambiguous'|'no_answer'|'voicemail'|'dropped'|'wrong_number'|'refused';
export type Ending = 'completed'|'no_answer'|'voicemail'|'dropped'|'wrong_number'|'refused';
export type Actor = { id:string; name:string; role:'coordinator'|'viewer' };
export type Shipment = {id:string;reference:string;contactId:string;origin:string;destination:string;windowStart:string;windowEnd:string;windowTz:string;scenarioId:string;status:string;retiredAt?:string;retiredBy?:string;retireReason?:string};
export type Contact = {id:string;name:string;person:string;phone:string;suppressed:boolean;reason?:string};
export type Check = {id:string;requestId:string;shipmentId:string;status:'active'|'finished';autoRetriesUsed:number;retryPending:boolean;retryOf?:string;requestedBy?:string;requestedAt?:string;finishReason?:string};
export type Attempt = {id:string;requestId:string;shipmentId:string;checkId:string;trigger:'initial'|'auto_retry'|'manual_retry';mode:'simulated';inputMethod?:'browser_voice'|'typed_demo';voiceIntent?:string;frustrated?:boolean;attemptNumber?:number;status:'in_progress'|'finished';startedAt:string;endedAt?:string;outcome?:Outcome;transcript?:string;summary?:string;clarificationAsked?:boolean;timedOut?:boolean;escalationId?:string};
export type Report = {id:string;shipmentId:string;attemptId:string|null;source:'carrier'|'human_correction';raw:string;instant:string|null;date?:string;time?:string;tz?:string;capture:'captured'|'uncaptured';completeness:'complete'|'partial'|'range'|'conflict';assessment:Assessment;delay:boolean;stale:boolean;recordedAt:string;recordedBy:string;reason?:string;correctsReportId?:string};
export type Escalation = {id:string;shipmentId:string;status:'open'|'acknowledged'|'resolved';reasons:{reason:string;attemptId:string;at:string}[];attemptIds:string[];openedAt:string;acknowledgedAt?:string;acknowledgedBy?:string;resolvedAt?:string;resolvedBy?:string;resolutionNote?:string;reopenCount:number;retryPending:boolean};
export type Audit = {id:string;entityId:string;action:string;actorId:string;actorName:string;actorType:string;at:string;details:unknown};
export type CallEvent = {id:string;attemptId:string;providerEventId:string;disposition:'applied'|'content_not_applied'|'ignored_late';at:string;payload:unknown};
export type State = {version:number;clock:string;company:{name:string;timezone:string;queue:string;script:string;timeoutSeconds?:number};contacts:Contact[];shipments:Shipment[];checks:Check[];attempts:Attempt[];reports:Report[];escalations:Escalation[];events:CallEvent[];audit:Audit[];annotations:{id:string;shipmentId:string;text:string;actorId:string;at:string}[];suppressionEvents:{id:string;contactId:string;action:string;reason:string;actorId:string;at:string;escalationId?:string}[];requests:string[]};
export type Result = {voiceIntent?:string;frustrated?:boolean;outcome:Outcome;capture:'captured'|'uncaptured';instant:string|null;tz?:string;date?:string;time?:string;assessment:Assessment;delay:boolean;completeness:Report['completeness'];reasons:string[];clarificationAsked:boolean;raw:string};
export const RC='2026-11-10T15:00:00Z';
export const localActor:Actor={id:'local-coordinator',name:'Alex Morgan (simulated)',role:'coordinator'};
export function zoned(local:string,tz:string):string { return Temporal.PlainDateTime.from(local).toZonedDateTime(tz,{disambiguation:'reject'}).toInstant().toString(); }
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
function parse(text:string,clock:string):{instant:string|null;tz?:string;date?:string;time?:string;completeness:Report['completeness'];kind:string} {
  const lower=text.toLowerCase();
  if(hasUnresolvedTimeReference(text))return {instant:null,completeness:'partial',kind:'ambiguous'};
  const dates=[...lower.matchAll(new RegExp('('+months.join('|')+')\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?','g'))].map(m=>m[1]+' '+m[2]);
  const times=[...lower.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/g)].map(m=>m[1]+':'+(m[2]||'00')+m[3][0]);
  const zones=[/\bcentral time\b|\bct\b/,/\beastern time\b|\bet\b/,/\bmountain time\b|\bmt\b/,/\b(?:india|indian) standard time\b/].filter(re=>re.test(lower));
  if(new Set(dates).size>1||new Set(times).size>1||zones.length>1)return {instant:null,completeness:'conflict',kind:'range_or_conflict'};
  if(/\bbetween\b|\b\d[^\n]*\bto\s+\d/.test(lower)) return {instant:null,completeness:'range',kind:'range_or_conflict'};
  if(/\bactually\b|\bor\s+\d/.test(lower)) return {instant:null,completeness:'conflict',kind:'range_or_conflict'};
  const tz=/\bcentral time\b|\bct\b/i.test(text)?'America/Chicago':/\beastern time\b|\bet\b/i.test(text)?'America/New_York':/\bmountain time\b|\bmt\b/i.test(text)?'America/Denver':/\b(?:india|indian) standard time\b/i.test(text)?'Asia/Kolkata':undefined;
  const tm=text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  const dm=lower.match(new RegExp('('+months.join('|')+')\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?'));
  const iso=lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if(!tz||!tm||(!dm&&!iso&&!/\btoday\b|\btomorrow\b/.test(lower))) return {instant:null,tz,completeness:'partial',kind:(!tm?'ambiguous':'incomplete_eta')};
  try {
    const today=Temporal.Instant.from(clock).toZonedDateTimeISO(tz).toPlainDate();
    let date:Temporal.PlainDate;
    if(iso) date=Temporal.PlainDate.from(iso[1]);
    else if(dm){ const month=months.indexOf(dm[1])+1;date=Temporal.PlainDate.from({year:dm[3]?Number(dm[3]):today.year,month,day:Number(dm[2])},{overflow:'reject'}); if(!dm[3]&&Temporal.PlainDate.compare(date,today)<0)date=date.add({years:1}); }
    else date= /\btomorrow\b/.test(lower)?today.add({days:1}):today;
    // A calendar date and a relative day must agree. Do not silently roll a
    // past month/day into next year when the caller also said "tomorrow".
    if((dm||iso)&&/\btoday\b|\btomorrow\b/.test(lower)){
      const relative=/\btomorrow\b/.test(lower)?today.add({days:1}):today;
      if(!date.equals(relative))return {instant:null,tz,completeness:'conflict',kind:'range_or_conflict'};
    }
    const hour=Number(tm[1]), minute=Number(tm[2]||0); if(hour<1||hour>12||minute>59)throw Error('time');
    const time=Temporal.PlainTime.from({hour:hour%12+(/^p/i.test(tm[3])?12:0),minute});
    const instant=date.toPlainDateTime(time).toZonedDateTime(tz,{disambiguation:'reject'}).toInstant().toString();
    return {instant,tz,date:date.toString(),time:time.toString(),completeness:'complete',kind:'ok'};
  } catch {return {instant:null,tz,completeness:'partial',kind:'ambiguous'};}
}
export function interpret(ending:Ending,text:string,clarification:string|undefined,shipment:Pick<Shipment,'windowStart'|'windowEnd'>,clock=RC):Result {
  const delay=(ending==='completed'||ending==='dropped')&&hasDelayEvidence(text+' '+(clarification||''));
  const base:Result={outcome:'ambiguous',capture:'uncaptured',instant:null,assessment:delay?'delay':'none',delay,completeness:'partial',reasons:[],clarificationAsked:false,raw:text};
  if(ending!=='completed') return {...base,outcome:ending,reasons:[ending==='no_answer'?'unanswered':ending,...(delay?['delay_reported']:[])]};
  let p=parse(text,clock);
  if(!p.instant&&p.completeness==='partial'){
    base.clarificationAsked=true;
    if(clarification){
      // A complete clarification supersedes an ambiguous time; otherwise add the missing date/zone.
      const replacement=parse(clarification,clock);
      p=replacement.instant?replacement:parse(text+' '+clarification,clock);
      base.raw=text+'\nAgent: Please clarify the date, time and timezone.\nCarrier: '+clarification;
    } else base.raw=text+'\nAgent: Please clarify the date, time and timezone.\nCarrier: No clarification provided.';
  }
  const assessment:Assessment=delay?'delay':p.instant?(Date.parse(p.instant)>Date.parse(shipment.windowEnd)?'delay':Date.parse(p.instant)<Date.parse(shipment.windowStart)?'early':'on_time'):'none';
  const reasons=delay?['delay_reported']:assessment==='delay'?['eta_after_window']:p.instant?[]:[p.kind];
  return {...base,...p,capture:p.instant?'captured':'uncaptured',outcome:p.instant?'eta_captured':p.kind==='incomplete_eta'?'eta_incomplete':'ambiguous',assessment,reasons};
}
export function interpretVoice(text:string,clarification:string|undefined,shipment:Pick<Shipment,'windowStart'|'windowEnd'>,clock=RC):Result {
 const ending=voiceEnding(text+' '+(clarification||''));
 const normalized=normalizeSpeech(text),followup=clarification?normalizeSpeech(clarification):undefined;
 const result=interpret(ending,normalized,followup,shipment,clock);
 // Uncertain estimates are never promoted to a precise ETA by normalization.
 const completeClarification=followup&&!hasArrivalWindow(followup)?interpret('completed',followup,undefined,shipment,clock).capture==='captured':false;
 const uncertain=uncertainSpeech(clarification||'')||hasArrivalWindow(clarification||'')||(!completeClarification&&(uncertainSpeech(text)||hasArrivalWindow(text)));
 if(ending==='completed'&&uncertain){result.instant=null;result.capture='uncaptured';result.outcome='ambiguous';result.completeness='partial';result.assessment=result.delay?'delay':'none';result.reasons=result.delay?['delay_reported','ambiguous']:['ambiguous'];}
 const times=[...(followup||normalized).matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/gi)].map(m=>`${m[1]}:${m[2]||'00'}${m[3][0].toLowerCase()}`);
 if(ending==='completed'&&new Set(times).size>1){result.instant=null;result.capture='uncaptured';result.outcome='ambiguous';result.completeness='conflict';result.assessment=result.delay?'delay':'none';result.reasons=result.delay?['delay_reported','range_or_conflict']:['range_or_conflict'];}
 const classification=classifyVoiceIntent(text+' '+(clarification||''));
 result.voiceIntent=classification.intent;result.frustrated=classification.frustrated;
 if(ending==='completed'){if(classification.humanRequested)result.reasons.push('human_requested');if(classification.frustrated)result.reasons.push('caller_frustrated');}
 result.raw=text+(clarification?'\nAgent: '+voicePrompts[voiceClarification(text)]+'\nCarrier: '+clarification:'');
 return result;
}
export type Scenario={id:string;label:string;description:string;steps:{ending:Ending;text:string;clarification?:string}[]};
// Only caller messages contribute evidence. Scripted replies are never carrier facts.
// Later handoff details may flag a problem, but never establish a new ETA.
export function withHandoffNotes(result:Result,notes:string[]):Result {
 if(!Array.isArray(notes)||notes.length>20||notes.some(n=>typeof n!=='string'||n.length>2000))throw Error('Invalid handoff caller notes.');
 if(!notes.length)return result;
 const r={...result,reasons:[...result.reasons],raw:result.raw+'\n'+notes.map(n=>'Handoff caller: '+n).join('\n')};
 if(notes.some(hasDelayEvidence)){r.delay=true;r.assessment='delay';if(!r.reasons.includes('delay_reported'))r.reasons.push('delay_reported');}
 const ending=notes.map(voiceEnding).find(e=>e==='wrong_number'||e==='refused');
 if(ending){r.outcome=ending as Outcome;r.instant=null;r.capture='uncaptured';if(!r.reasons.includes(ending))r.reasons.push(ending);}
 return r;
}
const ontime='November 11, 2026 at 3:30 PM Central Time';
export const scenarios:Scenario[]=[
{id:'on_time',label:'On-time ETA',description:'Complete date, time and timezone.',steps:[{ending:'completed',text:ontime}]},
{id:'late',label:'Late arrival',description:'Reported ETA is outside the delivery window.',steps:[{ending:'completed',text:'November 11, 2026 at 6:30 PM Central Time'}]},
{id:'delay',label:'Breakdown reported',description:'Explicit delay with no usable ETA.',steps:[{ending:'completed',text:'Truck broke down, not sure when'}]},
{id:'delay_in_window',label:'Delay · in-window ETA',description:'Delay language always reaches a human.',steps:[{ending:'completed',text:'We are running late. November 11, 2026 at 4:00 PM Central Time'}]},
{id:'ambiguous',label:'Unclear answer',description:'No usable clarification.',steps:[{ending:'completed',text:'Should be there soon',clarification:'I am not sure'}]},
{id:'clarify',label:'Clarification succeeds',description:'Missing timezone supplied in one clarification.',steps:[{ending:'completed',text:'November 11, 2026 at 3:30 PM',clarification:'Central Time'}]},
{id:'incomplete',label:'Incomplete ETA',description:'Missing timezone remains unresolved.',steps:[{ending:'completed',text:'November 11, 2026 at 3:30 PM',clarification:'I do not know'}]},
{id:'no_answer',label:'No answer',description:'Immediate escalation and one pending retry.',steps:[{ending:'no_answer',text:'No answer.'},{ending:'no_answer',text:'No answer on retry.'}]},
{id:'retry_success',label:'Retry succeeds',description:'On-time retry; human still resolves the issue.',steps:[{ending:'no_answer',text:'No answer.'},{ending:'completed',text:ontime}]},
{id:'voicemail',label:'Voicemail',description:'Voicemail never creates an ETA.',steps:[{ending:'voicemail',text:'Please leave a message.'}]},
{id:'dropped',label:'Dropped call',description:'Partial conversation is kept, ETA stays uncaptured.',steps:[{ending:'dropped',text:'Around 3 and…'}]},
{id:'dropped_delay',label:'Dropped · delay reported',description:'Preserve both the failure and delay evidence.',steps:[{ending:'dropped',text:'We are running late, maybe 4 PM Central—'}]},
{id:'wrong_number',label:'Wrong number',description:'Suppress the contact until reviewed.',steps:[{ending:'wrong_number',text:'Wrong number. I am not your carrier.'}]},
{id:'refused',label:'Carrier refuses',description:'Suppress the contact until reviewed.',steps:[{ending:'refused',text:'I cannot share that information.'}]},
{id:'range',label:'ETA range',description:'A range remains unconfirmed.',steps:[{ending:'completed',text:'Between 2 and 4 PM Central Time on November 11, 2026'}]},
{id:'conflict',label:'Conflicting times',description:'Self-correction is conservatively escalated.',steps:[{ending:'completed',text:'3 PM… actually 6 PM, November 11, 2026 Central Time'}]},
{id:'early',label:'Early arrival',description:'Shown as early, not a delay.',steps:[{ending:'completed',text:'November 11, 2026 at 10:00 AM Central Time'}]},
{id:'mixed',label:'Dropped → refusal',description:'Retry adds a second reason and suppresses contact.',steps:[{ending:'dropped',text:'Hello…'},{ending:'refused',text:'I will not provide that.'}]},
];
export const scenarioById=(id:string)=>scenarios.find(x=>x.id===id)||scenarios[0];
export function latestEta(s:State,id:string){return s.reports.filter(r=>r.shipmentId===id&&r.capture==='captured'&&!r.stale).at(-1);}
export function openIssue(s:State,id:string){return s.escalations.find(e=>e.shipmentId===id&&e.status!=='resolved');}
function recompute(s:State,id:string){
 const sh=s.shipments.find(x=>x.id===id)!; const a=s.reports.filter(r=>r.shipmentId===id&&!r.stale&&r.assessment!=='none').at(-1);
 const finished=s.attempts.filter(x=>x.shipmentId===id&&x.status==='finished');
 sh.status=!a?(finished.length?'unconfirmed':'not_checked'):a.assessment==='delay'?'delay_reported':finished.some(x=>x.startedAt>a.recordedAt&&!s.reports.some(r=>r.attemptId===x.id&&!r.stale&&r.assessment!=='none'))?'unconfirmed':'on_time_reported';
}
export const timeoutSeconds=(s:State)=>s.company.timeoutSeconds??120;
function fingerprint(value:unknown):string{let hash=2166136261;for(const char of JSON.stringify(value??null)){hash=Math.imul(hash^char.charCodeAt(0),16777619);}return 'fnv1a32-'+(hash>>>0).toString(16).padStart(8,'0');}
export type Action = {type:string;requestId:string;shipmentId?:string;[key:string]:unknown};
const requireText=(v:unknown,name:string,max=1000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${name} is required (maximum ${max} characters).`);return v.trim();};
export function transition(input:State,a:Action,actor:Actor,settle=true):State {
 if(actor.role!=='coordinator')throw Error('Read-only role cannot change records.');
 const s:State=structuredClone(input); if(s.requests.includes(a.requestId))return s;
 if(!a.requestId||a.requestId.length>150)throw Error('A valid request ID is required.');
 if(a.type==='voice_demo'){
  if(a.expectedVersion!==input.version)throw Error('The workspace changed during this conversation. Close the draft, refresh the workspace, and review a new voice demo before saving.');
  if(a.reviewed!==true)throw Error('Review the voice transcript before saving.');
  if(!['browser_voice','typed_demo'].includes(String(a.inputMethod)))throw Error('Voice input method required.');
  const text=requireText(a.text,'Reviewed carrier answer',4000);
  const clarification=a.clarification?requireText(a.clarification,'Clarification',2000):undefined;
  if(a.heard!==undefined&&(typeof a.heard!=='string'||a.heard.length>6000))throw Error('Invalid original transcript.');
  let handoffSession:unknown;let handoffCallerNotes:string[]=[];
  if(a.handoffSession!==undefined){
   const h=a.handoffSession as {status?:unknown;messages?:unknown;interaction?:unknown};
   if(!h||a.handoffChoice!=='accepted'||!['waiting','joined','ended'].includes(String(h.status))||!Array.isArray(h.messages)||h.messages.length>20)throw Error('Invalid simulated handoff.');
   if(h.status==='waiting'&&h.messages.length)throw Error('Join the simulated handoff before replying.');
   if(h.interaction!==undefined&&!['automatic','manual'].includes(String(h.interaction)))throw Error('Invalid handoff interaction.');
   handoffSession={interaction:h.interaction,status:h.status,mode:'simulated_only',messages:h.messages.map(m=>{if(!m||!['coordinator','caller'].includes(m.role))throw Error('Invalid handoff role.');if(m.source!==undefined&&(m.source!=='scripted'||m.role!=='coordinator'))throw Error('Invalid handoff source.');return {role:m.role,text:requireText(m.text,'Handoff reply',2000),...(m.source==='scripted'?{source:'scripted'}:{})};})};
   handoffCallerNotes=h.messages.filter(m=>m.role==='caller').map(m=>m.text);
  }
  // Start and finish are persisted together: abandoning a draft leaves no stuck check.
  const started=transition(input,{type:'request',shipmentId:a.shipmentId,requestId:a.requestId+':start'},actor);
  const attempt=started.attempts.at(-1)!;
  attempt.inputMethod=a.inputMethod as Attempt['inputMethod'];
  const ended=transition(started,{type:'event',attemptId:attempt.id,requestId:a.requestId+':end',payload:{ending:voiceEnding(text+' '+(clarification||'')),text,clarification,voiceDemo:true,handoffCallerNotes}},actor);
  ended.audit.push({id:'voice-review-'+a.requestId,entityId:attempt.id,action:'voice_demo_reviewed',details:{inputMethod:a.inputMethod,handoffChoice:a.handoffChoice==='accepted'||a.handoffChoice==='declined'?a.handoffChoice:undefined,handoffMode:'simulated_only',handoffSession,heard:a.heard||null,reviewedText:text,clarification:clarification||null},at:ended.clock,actorId:actor.id,actorName:actor.name,actorType:'human'});
  ended.requests.push(a.requestId);ended.version=input.version+1;return ended;
 }

 s.clock=Temporal.Instant.from(s.clock).add({seconds:1}).toString();const now=s.clock;
 const id=(kind:string,n=0)=>`${kind}-${a.requestId}-${n}`;
 const audit=(entityId:string,action:string,details:unknown={},system=false)=>s.audit.push({id:id('audit',s.audit.length),entityId,action,details:structuredClone(details),at:now,actorId:system?'simulation':actor.id,actorName:system?'Simulation engine':actor.name,actorType:system?'system':'human'});
 const ship=()=>{const sh=s.shipments.find(x=>x.id===a.shipmentId);if(!sh)throw Error('Shipment not found.');return sh;};
 const active=(sh:Shipment)=>s.checks.find(c=>c.shipmentId===sh.id&&c.status==='active');
 const finish=(c:Check,reason:string)=>{c.status='finished';c.retryPending=false;c.finishReason=reason;};
 const syncPending=(shid:string)=>{const e=openIssue(s,shid);if(e)e.retryPending=s.checks.some(c=>c.shipmentId===shid&&c.status==='active'&&c.retryPending);};
 const suppress=(contactId:string,reason:string,escalationId?:string)=>{const c=s.contacts.find(c=>c.id===contactId)!;c.suppressed=true;c.reason=reason;s.suppressionEvents.push({id:id('suppression',s.suppressionEvents.length),contactId,action:'suppressed',reason,actorId:'simulation',at:now,escalationId});audit(contactId,'contact_suppressed',{reason},true);
   // Cancel waiting retries on other shipments sharing the contact so they do not block checks forever.
   for(const ch of s.checks.filter(ch=>ch.status==='active'&&ch.retryPending&&s.shipments.find(sh=>sh.id===ch.shipmentId)?.contactId===contactId)){finish(ch,'contact_suppressed');syncPending(ch.shipmentId);audit(ch.id,'retry_cancelled',{reason:'contact_suppressed',escalationId:openIssue(s,ch.shipmentId)?.id},true);}
 };
 const ensureIssue=(sh:Shipment,at:Attempt,reasons:string[])=>{let e=openIssue(s,sh.id);if(!e){e={id:id('issue',s.escalations.length),shipmentId:sh.id,status:'open',reasons:[],attemptIds:[],openedAt:now,reopenCount:0,retryPending:false};s.escalations.push(e);audit(e.id,'escalation_opened',{shipmentId:sh.id},true);}for(const reason of reasons){if(!e.reasons.some(r=>r.reason===reason&&r.attemptId===at.id)){e.reasons.push({reason,attemptId:at.id,at:now});audit(e.id,'reason_added',{reason,attemptId:at.id},true);}}if(!e.attemptIds.includes(at.id)){e.attemptIds.push(at.id);audit(e.id,'attempt_linked',{attemptId:at.id},true);}at.escalationId=e.id;return e;};
 const startAttempt=(sh:Shipment,ch:Check,trigger:Attempt['trigger'])=>{if(s.contacts.find(c=>c.id===sh.contactId)?.suppressed)throw Error('Contact is suppressed. Review it before calling again.');const at:Attempt={id:id('attempt',s.attempts.length),requestId:a.requestId,shipmentId:sh.id,checkId:ch.id,trigger,mode:'simulated',attemptNumber:s.attempts.filter(at=>at.checkId===ch.id).length+1,status:'in_progress',startedAt:now};s.attempts.push(at);audit(at.id,'attempt_started',{shipmentId:sh.id,trigger,mode:'simulated'},true);return at;};
 switch(a.type){
 case 'attach_audio':{
  const r=a.recording as Record<string,unknown>;if(!r||r.consent!==true||typeof r.attemptId!=='string'||typeof r.id!=='string')throw Error('Consented recording metadata required.');
  const at=s.attempts.find(at=>at.id===r.attemptId),review=s.audit.find(x=>x.entityId===r.attemptId&&x.action==='voice_demo_reviewed');
  if(!at||at.inputMethod!=='browser_voice'||review?.actorId!==actor.id||r.shipmentId!==at.shipmentId)throw Error('Recording must belong to your reviewed conversation.');
  audit(at.id,'conversation_audio_saved',{recording:r});break;
 }
 case 'create':case 'edit': {
  const fields=a.fields as Record<string,unknown>;if(!fields)throw Error('Shipment fields required.');
  const voiceEntry=fields.entryMethod!==undefined;
  if(voiceEntry&&(!['browser_voice','typed_dictation'].includes(String(fields.entryMethod))||fields.voiceReviewed!=='on'))throw Error('Review all voice-filled shipment fields before saving.');
  const entryTranscript=voiceEntry?requireText(fields.voiceTranscript,'Shipment description',4000):undefined;
  const reference=requireText(fields.reference,'Reference',60);const contactId=requireText(fields.contactId,'Contact',100);const origin=requireText(fields.origin,'Origin',150);const destination=requireText(fields.destination,'Destination',150);const windowTz=requireText(fields.windowTz,'Timezone',100);
  const windowStart=zoned(requireText(fields.windowStart,'Window start',40),windowTz);const windowEnd=zoned(requireText(fields.windowEnd,'Window end',40),windowTz);if(Date.parse(windowEnd)<=Date.parse(windowStart))throw Error('Window end must be after start.');
  if(!s.contacts.some(c=>c.id===contactId))throw Error('Choose a seeded contact.');
  const scenarioId=requireText(fields.scenarioId,'Scenario',100);if(!scenarios.some(x=>x.id===scenarioId))throw Error('Unknown scenario.');
  const old=a.type==='edit'?ship():undefined;if(old&&(old.retiredAt||s.checks.some(c=>c.shipmentId===old.id)))throw Error('Shipment details are locked after the first check.');
  if(s.shipments.some(sh=>sh.reference.toLowerCase()===reference.toLowerCase()&&sh.id!==old?.id))throw Error('This reference is already reserved.');
  const sh:Shipment={id:old?.id||id('shipment'),reference,contactId,origin,destination,windowStart,windowEnd,windowTz,scenarioId,status:'not_checked'};
  if(old){const reason=requireText(a.reason,'Edit reason');audit(old.id,'shipment_edited',{before:old,after:sh,reason});Object.assign(old,sh);}else{s.shipments.push(sh);audit(sh.id,'shipment_created',{shipment:sh});}
  if(voiceEntry)audit(sh.id,'shipment_voice_entry_reviewed',{inputMethod:fields.entryMethod,transcript:entryTranscript,reviewedFields:sh});
  if(fields.note)s.annotations.push({id:id('note'),shipmentId:sh.id,text:requireText(fields.note,'Note'),actorId:actor.id,at:now});break;
 }
 case 'request':case 'manual_retry': {
  const sh=ship();if(sh.retiredAt)throw Error('Retired shipments cannot start checks.');if(active(sh))throw Error('A check or retry is already active for this shipment.');
  let previous:Check|undefined;if(a.type==='manual_retry'){previous=s.checks.filter(c=>c.shipmentId===sh.id).at(-1);if(!previous)throw Error('There is no previous check to retry.');}
  const c:Check={id:id('check'),requestId:a.requestId,shipmentId:sh.id,status:'active',autoRetriesUsed:previous?1:0,retryPending:false,retryOf:previous?.id,requestedBy:actor.id,requestedAt:now};s.checks.push(c);startAttempt(sh,c,previous?'manual_retry':'initial');break;
 }
 case 'run_retry':{const sh=ship();const c=active(sh);if(!c?.retryPending)throw Error('No retry is pending.');if(sh.retiredAt)throw Error('Shipment retired.');c.retryPending=false;startAttempt(sh,c,'auto_retry');syncPending(sh.id);break;}
 case 'complete':case 'event':case 'timeout': {
  const at=s.attempts.find(x=>x.id===a.attemptId);if(!at)throw Error('Attempt not found.');const sh=s.shipments.find(x=>x.id===at.shipmentId)!;const ch=s.checks.find(x=>x.id===at.checkId)!;
  const providerEventId=String(a.providerEventId||`terminal-${at.id}`);
  if(s.events.some(e=>e.attemptId===at.id&&e.providerEventId===providerEventId)){audit(at.id,'duplicate_event_received',{providerEventId,payloadHash:fingerprint(a.payload),hashAlgorithm:'fnv1a32 (non-security fingerprint)'},true);break;}
  if(at.status==='finished'){s.events.push({id:id('event'),attemptId:at.id,providerEventId,at:now,disposition:'ignored_late',payload:{}});audit(at.id,'late_event_ignored',{providerEventId},true);break;}
  const scenario=scenarioById(sh.scenarioId);const step=scenario.steps[at.trigger==='initial'?0:Math.min(1,scenario.steps.length-1)];
  const payload=a.type==='event'?a.payload as typeof step:a.type==='timeout'?{ending:'dropped' as Ending,text:'Simulation timed out.'}:step;
  if(!payload||!['completed','dropped','voicemail','no_answer','refused','wrong_number'].includes(payload.ending)||typeof payload.text!=='string'||payload.text.length>8000)throw Error('Invalid simulated event.');
  if(a.type==='timeout'&&Date.parse(now)-Date.parse(at.startedAt)<timeoutSeconds(s)*1000)throw Error('Attempt has not reached the configured simulated timeout.');
  const r=('voiceDemo' in payload&&payload.voiceDemo===true)?withHandoffNotes(interpretVoice(payload.text,payload.clarification,sh,at.startedAt),'handoffCallerNotes' in payload?payload.handoffCallerNotes as string[]:[]):interpret(payload.ending,payload.text,payload.clarification,sh,at.startedAt);
  s.audit.push({id:id('carrier-event'),entityId:at.id,action:'carrier_response_received',actorId:'simulated-carrier',actorName:'Simulated carrier',actorType:'simulated_carrier',at:now,details:{providerEventId,payloadHash:fingerprint(payload)}});
  s.audit.push({id:id('interpretation'),entityId:at.id,action:'eta_interpreted',actorId:'demo-agent',actorName:'Demo agent',actorType:'agent',at:now,details:{outcome:r.outcome,capture:r.capture,assessment:r.assessment,reasons:r.reasons,voiceIntent:r.voiceIntent,frustrated:r.frustrated}});
  const corrected=s.reports.some(r=>r.shipmentId===sh.id&&r.source==='human_correction'&&r.recordedAt>at.startedAt);
  Object.assign(at,{status:'finished',endedAt:now,outcome:r.outcome,transcript:r.raw,summary:r.reasons.length?r.reasons.join(', ').replaceAll('_',' '):`${r.assessment.replace('_',' ')} carrier-reported ETA`,clarificationAsked:r.clarificationAsked,timedOut:a.type==='timeout',voiceIntent:r.voiceIntent,frustrated:r.frustrated});
  const report:Report={id:id('report'),shipmentId:sh.id,attemptId:at.id,source:'carrier',raw:r.raw,instant:r.instant,tz:r.tz,date:r.date,time:r.time,capture:r.capture,completeness:r.completeness,assessment:corrected?'none':r.assessment,delay:r.delay,stale:corrected,recordedAt:now,recordedBy:'simulation'};s.reports.push(report);
  // Separate fresh delay evidence from a stale ETA so human corrections survive without hiding a breakdown.
  if(corrected&&r.delay)s.reports.push({...report,id:id('delay-evidence'),instant:null,capture:'uncaptured',assessment:'delay',stale:false});
  s.events.push({id:id('event'),attemptId:at.id,providerEventId,at:now,disposition:corrected?'content_not_applied':'applied',payload});
  if(r.reasons.length)ensureIssue(sh,at,r.reasons);
  else {const e=openIssue(s,sh.id);if(e){e.attemptIds.push(at.id);at.escalationId=e.id;audit(e.id,'retry_result_attached',{attemptId:at.id,summary:at.summary},true);}}
  if(r.outcome==='wrong_number'||r.outcome==='refused')suppress(sh.contactId,r.outcome,at.escalationId);
  const retryable=['no_answer','voicemail','dropped'].includes(r.outcome);
  if(retryable&&ch.autoRetriesUsed===0&&!s.contacts.find(c=>c.id===sh.contactId)!.suppressed){ch.autoRetriesUsed=1;ch.retryPending=true;}else finish(ch,corrected?'completed_after_correction':'attempt_finished');
  syncPending(sh.id);recompute(s,sh.id);audit(at.id,'attempt_finished',{outcome:r.outcome,capture:r.capture,stale:corrected,reasons:r.reasons},true);break;
 }
 case 'correct':{const sh=ship();const reason=requireText(a.reason,'Correction reason');const tz=requireText(a.timezone,'Timezone',100);const instant=zoned(requireText(a.localTime,'Date and time',40),tz);const current=latestEta(s,sh.id);const assessment=Date.parse(instant)>Date.parse(sh.windowEnd)?'delay':Date.parse(instant)<Date.parse(sh.windowStart)?'early':'on_time';s.reports.push({id:id('report'),shipmentId:sh.id,attemptId:null,source:'human_correction',raw:`Human correction: ${a.localTime} ${tz}`,instant,tz,capture:'captured',completeness:'complete',assessment,delay:false,stale:false,recordedAt:now,recordedBy:actor.id,reason,correctsReportId:current?.id});recompute(s,sh.id);audit(sh.id,'eta_corrected',{instant,reason,previous:current?.instant});break;}
 case 'acknowledge':case 'resolve':case 'reopen': {
  const e=s.escalations.find(e=>e.id===a.escalationId);if(!e)throw Error('Escalation not found.');
  if(a.type==='acknowledge'){if(e.status!=='open')throw Error('Only open issues can be acknowledged.');e.status='acknowledged';e.acknowledgedAt=now;e.acknowledgedBy=actor.id;}
  if(a.type==='resolve'){if(e.status==='resolved')throw Error('Already resolved.');e.resolutionNote=requireText(a.reason,'Resolution note');e.status='resolved';e.resolvedAt=now;e.resolvedBy=actor.id;for(const c of s.checks.filter(c=>c.shipmentId===e.shipmentId&&c.retryPending)){finish(c,'retry_cancelled_by_resolution');audit(c.id,'retry_cancelled',{escalationId:e.id},true);}e.retryPending=false;}
  if(a.type==='reopen'){if(e.status!=='resolved'||openIssue(s,e.shipmentId))throw Error('An active issue already exists, or this issue is not resolved.');e.status='open';e.reopenCount++;}
  audit(e.id,'escalation_'+a.type,{note:a.reason});break;
 }
 case 'suppression_review':{const c=s.contacts.find(c=>c.id===a.contactId);if(!c)throw Error('Contact not found.');const reason=requireText(a.reason,'Review reason');const clear=a.clear===true;c.suppressed=!clear;c.reason=clear?undefined:reason;s.suppressionEvents.push({id:id('suppression'),contactId:c.id,action:clear?'cleared':'kept_after_review',reason,actorId:actor.id,at:now,escalationId:s.suppressionEvents.filter(e=>e.contactId===c.id).at(-1)?.escalationId});audit(c.id,'suppression_reviewed',{clear,reason});break;}
 case 'annotate':{const sh=ship();const text=requireText(a.text,'Note',2000);s.annotations.push({id:id('annotation'),shipmentId:sh.id,text,actorId:actor.id,at:now});audit(sh.id,'annotation_added',{text});break;}
 case 'retire':{const sh=ship();if(active(sh))throw Error('Finish the active check before retiring.');if(sh.retiredAt)throw Error('Already retired.');sh.retiredAt=now;sh.retiredBy=actor.id;sh.retireReason=requireText(a.reason,'Retirement reason');audit(sh.id,'shipment_retired',{reason:sh.retireReason});break;}
 case 'scenario':{const sh=ship();if(active(sh))throw Error('Finish the active check before changing scenario.');if(!scenarios.some(sc=>sc.id===a.scenarioId))throw Error('Unknown scenario.');const before=sh.scenarioId;sh.scenarioId=String(a.scenarioId);audit(sh.id,'demo_scenario_selected',{before,after:sh.scenarioId});break;}
 case 'advance_clock':{const seconds=Number(a.seconds);if(!Number.isInteger(seconds)||seconds<1||seconds>86400)throw Error('Clock step must be 1–86400 seconds.');s.clock=Temporal.Instant.from(now).add({seconds}).toString();audit('clock','simulation_clock_advanced',{seconds});break;}
 default:throw Error('Unknown action.');
 }
 s.requests.push(a.requestId);s.version=input.version+1;
 if(settle){let result=s;for(const at of s.attempts.filter(at=>at.status==='in_progress'&&Date.parse(s.clock)-Date.parse(at.startedAt)>=timeoutSeconds(s)*1000)){
  result=transition(result,{type:'timeout',attemptId:at.id,requestId:'expire-'+fingerprint([at.id,s.clock])},localActor,false);
 }result.version=input.version+1;return result;}
 return s;
}
export function seed(config:{timeoutSeconds?:number}={}):State {
 if(config.timeoutSeconds!==undefined&&(!Number.isInteger(config.timeoutSeconds)||config.timeoutSeconds<1||config.timeoutSeconds>3600))throw Error('Simulated timeout must be 1–3600 seconds.');
 const names=['Northline Freight','Prairie Transport','Blue River Logistics','Summit Carriers','Oakway Express','Harborline Freight','Redwood Transport','Lakeside Haulage'];
 const lanes=[['Chicago, IL','Indianapolis, IN'],['Dallas, TX','Memphis, TN'],['Kansas City, MO','St. Louis, MO'],['Atlanta, GA','Nashville, TN'],['Columbus, OH','Detroit, MI'],['Denver, CO','Omaha, NE'],['Milwaukee, WI','Chicago, IL'],['Louisville, KY','Cincinnati, OH']];
 return {version:0,clock:RC,company:{name:'Regenesys Logistics · Fictional demo',timezone:'America/Chicago',queue:'Operations',timeoutSeconds:config.timeoutSeconds??120,script:'Hello, this is a simulated shipment coordination call. Please provide the delivery date, time and timezone. Any delay or uncertainty goes directly to our coordinator.'},contacts:names.map((name,i)=>({id:`contact-${i+1}`,name,person:['Jamie','Taylor','Robin','Sam','Casey','Drew','Jordan','Alex'][i],phone:`+1 202-555-01${String(i).padStart(2,'0')}`,suppressed:false})),shipments:lanes.map(([origin,destination],i)=>({id:`shipment-${i+1}`,reference:`RG-${1041+i}`,contactId:`contact-${i+1}`,origin,destination,windowStart:'2026-11-11T19:00:00Z',windowEnd:'2026-11-11T23:00:00Z',windowTz:'America/Chicago',scenarioId:['on_time','late','retry_success','wrong_number','delay','clarify','dropped','range'][i],status:'not_checked'})),checks:[],attempts:[],reports:[],escalations:[],events:[],audit:[],annotations:[],suppressionEvents:[],requests:[]};
}
