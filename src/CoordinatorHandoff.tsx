import {useState} from 'react';
import {Dictation} from './Dictation';
import type {Shipment,Result} from './domain';

export type HandoffMessage={role:'coordinator'|'caller';text:string};
export type HandoffSession={status:'waiting'|'joined'|'ended';messages:HandoffMessage[]};
export function CoordinatorHandoff({shipment,result,transcript,session,onChange,onBack}:{shipment:Shipment;result:Result;transcript:string;session:HandoffSession;onChange:(s:HandoffSession)=>void;onBack:()=>void}){
 const [reply,setReply]=useState('');
 return <section className="coordinator-screen" aria-label="Coordinator desk">
  <div className="section-line"><h3>Coordinator desk</h3><span className="sim-label">SIMULATED</span></div>
  <p>You play the coordinator on this screen. Joining and replying stays inside this practice conversation; no phone call or external message is sent.</p>
  <div className="handoff-context"><strong>{shipment.reference} · {shipment.origin} → {shipment.destination}</strong><p>{result.delay?'Carrier reported a delay.':result.frustrated?'Caller is frustrated and needs help.':'Caller needs a coordinator.'}</p><p>{result.instant?'Reported ETA: '+result.date+' '+result.time+' '+result.tz:'Arrival time is unconfirmed. Ask the caller before recording an ETA.'}</p><p>Delivery window: {new Date(shipment.windowStart).toLocaleString('en-US',{timeZone:shipment.windowTz})} – {new Date(shipment.windowEnd).toLocaleString('en-US',{timeZone:shipment.windowTz})} · {shipment.windowTz}</p><details open><summary>Conversation so far</summary><pre>{transcript}</pre></details></div>
  <p role="status">{session.status==='waiting'?'Waiting for you to join the practice conversation.':session.status==='joined'?'Coordinator role active in this simulation.':'Practice conversation ended.'}</p>
  {session.status==='waiting'&&<button className="primary" onClick={()=>onChange({...session,status:'joined'})}>Join practice conversation</button>}
  {session.messages.length>0&&<ol className="handoff-messages">{session.messages.map((m,i)=><li key={i}><strong>{m.role==='coordinator'?'Coordinator':'Caller'} · simulated</strong><p>{m.text}</p></li>)}</ol>}
  {session.status==='joined'&&<><label className="voice-field">Coordinator reply<textarea value={reply} maxLength={2000} onChange={e=>setReply(e.target.value)} placeholder="For example: I'm here to help. Tell me what happened and I'll review the delivery with you."/></label><Dictation label="Dictate reply" onText={setReply}/><div className="voice-controls"><button className="primary" disabled={!reply.trim()||session.messages.length>=20} onClick={()=>{onChange({...session,messages:[...session.messages,{role:'coordinator',text:reply.trim()}]});setReply('');}}>Send practice reply</button><button onClick={()=>onChange({...session,status:'ended'})}>End practice conversation</button></div></>}
  <button onClick={onBack}>Back to caller screen</button><small>Replies become part of the activity record only after you review and save the conversation.</small>
 </section>;
}
