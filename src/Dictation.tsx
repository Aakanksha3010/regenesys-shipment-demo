import {useEffect,useRef,useState} from 'react';
import {Mic,Square} from 'lucide-react';

type Recognition={lang:string;continuous:boolean;interimResults:boolean;start:()=>void;abort:()=>void;stop:()=>void;onresult:((e:any)=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null};

// One deliberate microphone action, bounded listening, and no automatic save.
export function Dictation({onText,disabled=false,label='Dictate shipment'}:{onText:(text:string)=>void;disabled?:boolean;label?:string}){
 const [consent,setConsent]=useState(false),[listening,setListening]=useState(false),[error,setError]=useState('');
 const current=useRef<Recognition|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),alive=useRef(true);
 const SpeechRecognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
 function cancel(){if(timer.current)clearTimeout(timer.current);const r=current.current;current.current=null;if(r){r.onresult=null;r.onend=null;r.onerror=null;r.abort();}if(alive.current)setListening(false);}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;cancel();};},[]);
 function start(){
  if(!consent||!SpeechRecognition||disabled)return;
  cancel();setError('');setListening(true);let final='',failed=false;
  const r:Recognition=new SpeechRecognition();current.current=r;r.lang='en-US';r.continuous=false;r.interimResults=false;
  r.onresult=e=>{if(current.current!==r)return;final='';for(let i=0;i<e.results.length;i++)if(e.results[i].isFinal)final+=e.results[i][0].transcript+' ';};
  r.onerror=e=>{if(current.current!==r)return;failed=true;setError(e.error==='not-allowed'||e.error==='service-not-allowed'?'Microphone access was denied. You can type the details instead.':'No usable speech was captured. Try again or type the details.');};
  r.onend=()=>{if(current.current!==r||!alive.current)return;cancel();if(!failed&&final.trim())onText(final.trim().slice(0,4000));else if(!failed)setError('No speech was captured. Nothing has changed.');};
  timer.current=setTimeout(()=>{if(current.current===r){cancel();setError('Listening timed out. Nothing was applied. Try a shorter description.');}},30000);
  try{r.start();}catch{cancel();setError('Could not start the microphone. Try Chrome or type the details.');}
 }
 return <div className="dictation-controls">
  <label className="voice-consent"><input type="checkbox" checked={consent} disabled={disabled||listening} onChange={e=>setConsent(e.target.checked)}/><span>Use my microphone. My browser may process audio through its speech service; this app does not store recordings.</span></label>
  {!SpeechRecognition&&<p className="hint">Microphone input needs a supported browser such as Chrome. You can still type below.</p>}
  <div className="voice-controls"><button type="button" disabled={disabled||listening||!consent||!SpeechRecognition} onClick={start}><Mic size={16}/>{label}</button>{listening&&<button type="button" onClick={cancel}><Square size={15}/>Cancel dictation</button>}</div>
  {listening&&<p role="status">Listening…</p>}{error&&<p role="alert" className="error">{error}</p>}
 </div>;
}
