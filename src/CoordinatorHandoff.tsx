import {useState} from 'react';
import {Dictation} from './Dictation';
import type {Shipment,Result} from './domain';
import {coordinatorReply,coordinatorContext} from './coordinator-script';
import {voicePrompts,type VoicePrompt} from './voice-prompts';

export type HandoffMessage={role:'coordinator'|'caller';text:string;source?:'scripted'};
export type HandoffSession={status:'waiting'|'joined'|'ended';messages:HandoffMessage[];interaction?:'automatic'|'manual'};
export function CoordinatorHandoff({shipment,clock,result,transcript,session,onChange,onBack,onSpeak,onStop,speaking=false,audioError='',recordingActive=false}:{shipment:Shipment;clock:string;result:Result;transcript:string;session:HandoffSession;onChange:(s:HandoffSession)=>void;onBack:()=>void;onSpeak:(prompt:VoicePrompt)=>void;onStop:()=>void;speaking?:boolean;audioError?:string;recordingActive?:boolean}){
 const [reply,setReply]=useState('');
 const context=coordinatorContext(transcript,session.messages.filter(m=>m.role==='caller').map(m=>m.text),shipment,clock);
 const automatic=(session.interaction||(session.status==='waiting'?'automatic':'manual'))==='automatic';
 function start(){
  if(!automatic){onChange({...session,status:'joined',interaction:'manual'});return;}
  onChange({...session,status:'joined',interaction:'automatic',messages:[{role:'coordinator',text:voicePrompts[context.prompt],source:'scripted'}]});
  onSpeak(context.prompt);
 }
 function send(value:string){
  const text=value.trim().slice(0,2000);
  if(!text||session.status!=='joined'||speaking||session.messages.length>(automatic?17:19))return;
  if(automatic){
   const previous=session.messages.filter(m=>m.role==='caller').map(m=>m.text);
   const next=coordinatorReply(text,previous,coordinatorContext(transcript,[...previous,text],shipment,clock),context);
   onChange({...session,status:next.ended?'ended':'joined',messages:[...session.messages,{role:'caller',text},{role:'coordinator',text:voicePrompts[next.prompt],source:'scripted'}]});
   onSpeak(next.prompt);
  }else onChange({...session,messages:[...session.messages,{role:'coordinator',text}]});
  setReply('');
 }
 function end(){
  onStop();
  onChange({...session,status:'ended',messages:automatic&&session.messages.length<20?[...session.messages,{role:'coordinator',text:voicePrompts.coordinator_end,source:'scripted'}]:session.messages});
  if(automatic)onSpeak('coordinator_end');
 }
 return <section className="coordinator-screen" aria-label="Coordinator desk">
  <div className="section-line"><h3>Coordinator desk</h3><span className="sim-label">SIMULATED</span></div>
  <p>{automatic?'You stay in the caller role. A scripted practice coordinator responds aloud and in writing; no real person joins.':'You play the coordinator on this screen. Switch back to the caller screen to play that role.'} No phone call or external message is sent.</p>
  {session.status==='waiting'&&<label>Practice mode<select aria-label="Practice mode" value={automatic?'automatic':'manual'} onChange={e=>onChange({...session,interaction:e.target.value as 'automatic'|'manual'})}><option value="automatic">Automatic scripted coordinator</option><option value="manual">Manual · play both roles</option></select></label>}
  <div className="handoff-context"><strong>{shipment.reference} · {shipment.origin} → {shipment.destination}</strong><p>{result.delay?'Carrier reported a delay.':result.frustrated?'Caller is frustrated and needs help.':'Caller needs a coordinator.'}</p><p>{result.instant?'Reported ETA: '+result.date+' '+result.time+' '+result.tz:'Arrival time is unconfirmed. The human team must review it.'}</p><p>Delivery window: {new Date(shipment.windowStart).toLocaleString('en-US',{timeZone:shipment.windowTz})} – {new Date(shipment.windowEnd).toLocaleString('en-US',{timeZone:shipment.windowTz})} · {shipment.windowTz}</p><dl aria-label="Handoff context"><dt>Heard date mentions</dt><dd>{context.dates.join(' / ')||'Not captured'}</dd><dt>Heard arrival time</dt><dd>{context.time||'Not captured'}</dd><dt>Arrival timezone</dt><dd>{context.zone|| (context.texas?'Caller said Texas time; Central or Mountain is not confirmed.':'Not confirmed')}</dd><dt>What still needs attention</dt><dd>{context.needsZone?'Confirm the arrival timezone; keep the date and time already supplied.':context.conflictingDate?'The relative day and calendar date conflict with the practice clock. Confirm the calendar date and year.':result.reasons.map(r=>r.replaceAll('_',' ')).join(', ')||'Human team to review the reported details.'}</dd><dt>Practice clock date</dt><dd>{new Date(clock).toLocaleDateString('en-US',{timeZone:shipment.windowTz})}</dd></dl><details><summary>Conversation so far</summary><pre>{transcript}</pre></details></div>
  <p role="status">{speaking?'Practice coordinator speaking · wait to reply':session.status==='waiting'?'Ready to start the practice conversation.':session.status==='joined'?(automatic?'Your turn · speak or type a caller response below.':'Coordinator role active in this simulation.'):'Practice conversation ended. Return to the caller screen to review and save.'}</p>
  {speaking&&<button onClick={onStop}>Stop coordinator audio</button>}
  {audioError&&<p className="error" role="alert">{audioError} The written reply is available below.</p>}
  {session.status==='waiting'&&<button className="primary" onClick={start}>{automatic?'Start practice coordinator':'Join practice conversation'}</button>}
  {session.messages.length>0&&<ol className="handoff-messages" aria-live="polite">{session.messages.map((m,i)=><li key={i}><strong>{m.role==='coordinator'?(m.source==='scripted'?'Practice coordinator · scripted':'Coordinator · simulated'):'Caller · simulated'}</strong><p>{m.text}</p></li>)}</ol>}
  {session.status==='joined'&&<><label className="voice-field">{automatic?'Your response as caller':'Coordinator reply'}<textarea value={reply} disabled={speaking} maxLength={2000} onChange={e=>setReply(e.target.value)} placeholder={automatic?'Tell the team what happened, or say “that’s all” to finish.':"For example: I'm here to help. Tell me what happened."}/></label>
   <Dictation label={automatic?'Speak caller response':'Dictate reply'} disabled={speaking||session.messages.length>(automatic?17:19)} onText={automatic?send:setReply} recordingActive={recordingActive}/>
   {automatic&&<small>Speaking sends your response to this practice conversation and plays the next reply. Nothing is saved yet.</small>}
   <div className="voice-controls"><button className="primary" disabled={speaking||!reply.trim()||session.messages.length>(automatic?17:19)} onClick={()=>send(reply)}>{automatic?'Send caller response':'Send practice reply'}</button><button onClick={end}>End practice conversation</button></div></>}
  <button onClick={()=>{onStop();onBack();}}>Back to caller screen</button><small>Review and save to add these messages to the human-team handoff. Scripted replies cannot confirm an ETA, approve a delivery change, or resolve the issue.</small>
 </section>;
}
