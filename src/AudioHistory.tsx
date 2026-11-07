import {useEffect,useState} from 'react';
import type {State} from './domain';
export function AudioHistory({state,shipmentId,loadAudio}:{state:State;shipmentId?:string;loadAudio:(id:string)=>Promise<Blob>}){
 const records=state.audit.filter(a=>a.action==='conversation_audio_saved').map(a=>(a.details as any).recording).filter(r=>!shipmentId||r.shipmentId===shipmentId);
 return <section className="detail-section"><h3>Conversation recordings</h3>{!records.length?<p>No saved recordings. Recording is optional and requires consent before a conversation starts.</p>:records.toReversed().map(r=><Recording key={r.id} record={r} loadAudio={loadAudio}/>)}<small>Available to members of this workspace for seven days. Hold music and typed handoff replies are not included. Expired recordings cannot be played.</small></section>;
}
function Recording({record,loadAudio}:{record:any;loadAudio:(id:string)=>Promise<Blob>}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
 const expired=Date.parse(record.expiresAt)<=Date.now();
 return <div className="report-item"><strong>{new Date(record.createdAt).toLocaleString()} · {record.coverage==='microphone_and_bella'?'Microphone + Bella':'Microphone only'}</strong><small>{expired?'Expired':'Available until '+new Date(record.expiresAt).toLocaleString()}</small>{!expired&&!url&&<button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{setUrl(URL.createObjectURL(await loadAudio(record.id)));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?'Loading…':'Load recording'}</button>}{url&&!expired&&<audio controls src={url}/>} {error&&<p role="alert">{error}</p>}</div>;
}
