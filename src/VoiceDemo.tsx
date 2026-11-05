import {useEffect,useRef,useState} from 'react';
import {Mic,Square,Volume2,Check,AlertTriangle} from 'lucide-react';
import {interpretVoice,type Shipment,type Action} from './domain';

type Recognition = {
  lang:string; continuous:boolean; interimResults:boolean;
  onresult:((event:{results:ArrayLike<{isFinal:boolean;0:{transcript:string}}>})=>void)|null;
  onerror:((event:{error:string})=>void)|null;
  onend:(()=>void)|null;
  start:()=>void; stop:()=>void; abort:()=>void;
};
type SpeechWindow = Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};

export function VoiceDemo({shipment,clock,version,busy,onSave}:{shipment:Shipment;clock:string;version:number;busy:boolean;onSave:(a:Omit<Action,'requestId'>)=>Promise<boolean>}){
  const [consent,setConsent]=useState(false),[phase,setPhase]=useState<'ready'|'speaking'|'listening'|'review'>('ready');
  const [text,setText]=useState(''),[clarification,setClarification]=useState(''),[heard,setHeard]=useState('');
  const [question,setQuestion]=useState(''),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false);
  const [asked,setAsked]=useState(false),[usedMic,setUsedMic]=useState(false),[interim,setInterim]=useState('');
  const recognizer=useRef<Recognition|null>(null),alive=useRef(true),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const speechTimer=useRef<ReturnType<typeof setTimeout>|null>(null),generation=useRef(0),saving=useRef(false);
  const requestId=useRef(crypto.randomUUID());
  const openedVersion=useRef(version);
  const SpeechRecognition=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;
  const supportsSpeech='speechSynthesis' in window;
  const preview=interpretVoice(text,clarification||undefined,shipment,clock);
  const active=phase==='speaking'||phase==='listening';
  const needsClarification=!!text&&!asked&&!preview.delay&&preview.capture==='uncaptured'&&preview.outcome!=='refused'&&preview.outcome!=='wrong_number'&&preview.outcome!=='voicemail'&&preview.outcome!=='no_answer';
  const intro=`Hello, this is the Regenesys voice demo. No phone call is being made. You are playing the carrier for shipment ${shipment.reference}, going to ${shipment.destination}. What is your estimated arrival date, time, and timezone?`;
  const clarificationPrompt='Please clarify the arrival date, time including AM or PM, and timezone. If you are unsure, say so. I will send uncertainty to the coordinator.';

  function stop(){
    generation.current++;
    if(timer.current)clearTimeout(timer.current);
    if(speechTimer.current)clearTimeout(speechTimer.current);
    const r=recognizer.current;recognizer.current=null;
    if(r){r.onend=null;r.onresult=null;r.onerror=null;r.abort();}
    if(supportsSpeech)window.speechSynthesis.cancel();
  }
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;stop();};},[]);

  function speak(message:string,after?:()=>void){
    stop();setQuestion(message);setPhase('speaking');
    if(!supportsSpeech){setError('Spoken output is unavailable here. Read the agent prompt below.');setPhase('review');return;}
    const turn=generation.current;
    const utterance=new SpeechSynthesisUtterance(message);utterance.lang='en-US';utterance.rate=0.98;
    const voices=window.speechSynthesis.getVoices();
    utterance.voice=voices.find(v=>v.lang==='en-US'&&v.localService)||voices.find(v=>v.lang==='en-US')||null;
    const finish=(failed=false)=>{
      if(!alive.current||turn!==generation.current)return;
      generation.current++;
      if(speechTimer.current)clearTimeout(speechTimer.current);
      if(failed){window.speechSynthesis.cancel();setError('Audio playback was unavailable. Read the prompt and use “Speak answer” or type below.');setPhase('review');}
      else if(after)after();else setPhase('review');
    };
    utterance.onend=()=>finish();utterance.onerror=()=>finish(true);
    speechTimer.current=setTimeout(()=>finish(true),30000);
    window.speechSynthesis.speak(utterance);
  }

  function listen(followup=false,first=text){
    if(!consent||!SpeechRecognition){setError('Enable microphone use in a supported browser, or type a demo answer.');return;}
    stop();setError('');setInterim('');setReviewed(false);setPhase('listening');
    const r=new SpeechRecognition();recognizer.current=r;
    const turn=generation.current;let finalText='',failed=false;
    r.lang='en-US';r.continuous=false;r.interimResults=true;
    r.onresult=event=>{
      if(turn!==generation.current||!alive.current)return;
      let interimText='';finalText='';
      for(let i=0;i<event.results.length;i++){
        const result=event.results[i];
        if(result.isFinal)finalText+=result[0].transcript+' ';else interimText+=result[0].transcript+' ';
      }
      setInterim((finalText+interimText).trim());
    };
    r.onerror=event=>{
      if(turn!==generation.current||!alive.current)return;
      failed=true;
      setError(event.error==='not-allowed'||event.error==='service-not-allowed'?'Microphone or speech-service access was denied. Allow access in your browser, or type a demo answer.':event.error==='no-speech'?'No speech was detected. Try again or explicitly record no answer.':'Speech recognition failed. Check your microphone and connection, or type a demo answer.');
    };
    r.onend=()=>{
      if(turn!==generation.current||!alive.current)return;
      if(timer.current)clearTimeout(timer.current);
      recognizer.current=null;setInterim('');setPhase('review');
      const answer=finalText.trim();
      if(failed||!answer){if(!failed)setError('No speech was detected. Try again or explicitly record no answer.');return;}
      setUsedMic(true);setHeard(previous=>previous+(previous?'\n':'')+(followup?'Clarification: ':'Carrier: ')+answer);
      if(followup)setClarification(answer);else {setText(answer);setClarification('');}
      const result=interpretVoice(followup?first:answer,followup?answer:undefined,shipment,clock);
      if(!followup&&!result.delay&&result.capture==='uncaptured'&&['ambiguous','eta_incomplete'].includes(result.outcome)){
        setAsked(true);speak(clarificationPrompt,()=>listen(true,answer));
      }else{
        speak(result.reasons.length?'This needs human review. Please review the transcript, then save it to place the issue in the coordinator queue.':'Thank you. Please review the transcript and estimated arrival before saving it to the dashboard.');
      }
    };
    // Bound microphone time even if a recognition engine never emits an end event.
    timer.current=setTimeout(()=>{if(turn===generation.current){stop();setPhase('review');setInterim('');setError('Listening timed out. No partial transcript was saved. Try again or record no answer.');}},25000);
    try{r.start();}catch{stop();setPhase('review');setError('Could not start recognition. Try Chrome with microphone access, or type below.');}
  }

  function edit(value:string,followup=false){
    setReviewed(false);requestId.current=crypto.randomUUID();
    if(followup)setClarification(value);else setText(value);
  }
  return <div className="voice-demo">
    <div className="voice-badge"><Mic size={16}/>Voice demo — no phone call</div>
    <p>You play the carrier. The agent asks aloud, listens, and proposes a result. <strong>Nothing is saved until you review it.</strong></p>
    <p className="hint">Guided speech demo with rule-based ETA interpretation, not an open-ended AI conversation. Use fictional details only. “Today” and “tomorrow” use the demo clock: {new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:shipment.windowTz}).format(new Date(clock))}.</p>
    {!SpeechRecognition&&<div className="voice-warning">Speech recognition is unavailable in this browser. Open this app in Chrome for microphone input. You can still type an answer here; it will be labelled “typed demo”.</div>}
    <label className="voice-consent"><input type="checkbox" checked={consent} disabled={active||busy} onChange={e=>setConsent(e.target.checked)}/><span>Use my microphone for this demo. My browser may send audio to its speech-recognition service. Regenesys stores only the transcript I review and save, not audio.</span></label>
    <div className="voice-controls">
      <button className="primary" disabled={busy||active||!consent||!SpeechRecognition||!!text} onClick={()=>{setError('');speak(intro,()=>listen());}}><Mic size={17}/>Start conversation</button>
      <button disabled={busy||active} onClick={()=>speak(intro)}><Volume2 size={17}/>Hear agent</button>
      {active&&<button onClick={()=>{stop();setPhase('review');setInterim('');}}><Square size={16}/>Stop audio</button>}
    </div>
    <div className={'voice-agent '+(active?'active':'')} aria-live="polite"><span className="voice-orb"><Mic size={25}/></span><div><strong>{phase==='listening'?'Listening to your answer…':phase==='speaking'?'Agent speaking…':'Regenesys agent'}</strong><p>{question||intro}</p>{interim&&<p className="voice-interim">Heard so far: {interim}</p>}</div></div>
    {error&&<div className="error" role="alert">{error}</div>}
    <label className="voice-field">Carrier answer<textarea aria-label="Carrier answer" rows={3} maxLength={4000} disabled={active||busy} value={text} onChange={e=>edit(e.target.value)} placeholder="For example: November 11, 2026 at three thirty PM Central Time"/></label>
    <div className="voice-controls"><button disabled={busy||active||!consent||!SpeechRecognition||asked} onClick={()=>listen()}>Speak answer</button><button disabled={busy||active||!!text} onClick={()=>{edit('[No response heard]');setPhase('review');}}>Record no answer</button></div>
    {(asked||needsClarification)&&<div className="voice-followup"><p><strong>One clarification:</strong> {clarificationPrompt}</p><label className="voice-field">Clarification answer<textarea aria-label="Clarification answer" rows={2} maxLength={2000} disabled={active||busy} value={clarification} onChange={e=>{setAsked(true);edit(e.target.value,true);}}/></label><button disabled={busy||active||asked||!SpeechRecognition||!consent} onClick={()=>{setAsked(true);speak(clarificationPrompt,()=>listen(true));}}>Ask clarification aloud</button></div>}
    {text&&<div className={'voice-preview '+(preview.reasons.length?'needs-review':'')} aria-live="polite"><strong>{preview.reasons.length?<><AlertTriangle size={16}/>Human review required</>:<><Check size={16}/>ETA ready for review</>}</strong><p>{preview.instant?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:shipment.windowTz}).format(new Date(preview.instant))+' · '+shipment.windowTz:'No confirmed ETA will be recorded.'}</p><p>{preview.reasons.length?preview.reasons.join(', ').replaceAll('_',' '):'Carrier-reported estimate in this simulated conversation.'}</p>{['wrong_number','refused'].includes(preview.outcome)&&<p>The fictional contact will be suppressed until a coordinator reviews it.</p>}<small>{usedMic?'Browser voice transcript':'Typed demo answer'} · {preview.capture==='captured'?'Captured estimate':'Unconfirmed'} · saving creates a simulated check and audit history.</small></div>}
    <label className="voice-consent"><input type="checkbox" checked={reviewed} disabled={!text||active||busy} onChange={e=>setReviewed(e.target.checked)}/><span>I reviewed the transcript and proposed result.</span></label>
    <button className="primary voice-save" disabled={!reviewed||!text||active||busy} onClick={async()=>{if(saving.current)return;saving.current=true;try{await onSave({type:'voice_demo',requestId:requestId.current,expectedVersion:openedVersion.current,shipmentId:shipment.id,text,clarification:clarification||undefined,heard,reviewed:true,inputMethod:usedMic?'browser_voice':'typed_demo'});}finally{saving.current=false;}}}>{busy?'Saving…':'Save reviewed voice demo'}<Check size={16}/></button>
    <small>Closing discards this unsaved conversation. Delays and uncertainty enter the human queue when you save; the agent never negotiates or calls anyone.</small>
  </div>;
}
