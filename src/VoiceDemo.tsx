import {useEffect,useRef,useState} from 'react';
import {Mic,Square,Volume2,Check,AlertTriangle} from 'lucide-react';
import {interpretVoice,type Shipment,type Action} from './domain';
import {voicePrompts,type VoicePrompt,type VoiceOptions} from './voice-prompts';
import {voiceClarification,callerReply} from './voice-language';
import {playHoldMusic} from './hold-music';
import {CoordinatorHandoff,type HandoffSession} from './CoordinatorHandoff';
import {startRecording,type RecordingDraft} from './recording';

type Recognition = {
  lang:string; continuous:boolean; interimResults:boolean;
  onresult:((event:{results:ArrayLike<{isFinal:boolean;0:{transcript:string}}>})=>void)|null;
  onerror:((event:{error:string})=>void)|null;
  onend:(()=>void)|null;
  start:()=>void; stop:()=>void; abort:()=>void;
};
type SpeechWindow = Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};

export function VoiceDemo({shipment,clock,version,busy,onSave,loadVoices,generateSpeech,audioHistory=false}:{shipment:Shipment;clock:string;version:number;busy:boolean;onSave:(a:Omit<Action,'requestId'>,recording?:RecordingDraft)=>Promise<boolean>;loadVoices:()=>Promise<VoiceOptions>;generateSpeech:(prompt:VoicePrompt,voiceId:string,signal:AbortSignal)=>Promise<Blob>;audioHistory?:boolean}){
  const [consent,setConsent]=useState(false),[phase,setPhase]=useState<'ready'|'speaking'|'listening'|'holding'|'review'>('ready');
  const [text,setText]=useState(''),[clarification,setClarification]=useState(''),[heard,setHeard]=useState('');
  const [question,setQuestion]=useState(''),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false);
  const [sampleOnly,setSampleOnly]=useState(false);
  const [asked,setAsked]=useState(false),[usedMic,setUsedMic]=useState(false),[interim,setInterim]=useState('');
  const recognizer=useRef<Recognition|null>(null),alive=useRef(true),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const speechTimer=useRef<ReturnType<typeof setTimeout>|null>(null),generation=useRef(0),saving=useRef(false);
  const requestId=useRef(crypto.randomUUID());
  const [options,setOptions]=useState<VoiceOptions|null>(null),[voiceId,setVoiceId]=useState(''),[output,setOutput]=useState('elevenlabs');
  const [handoffOffered,setHandoffOffered]=useState(false),[handoffChoice,setHandoffChoice]=useState<'accepted'|'declined'|undefined>();
  const holdRequest=useRef<AbortController|null>(null);
  const [handoff,setHandoff]=useState<HandoffSession|null>(null),[coordinatorScreen,setCoordinatorScreen]=useState(false),[callerMessage,setCallerMessage]=useState('');
  const [recordConsent,setRecordConsent]=useState(false),[recordingActive,setRecordingActive]=useState(false),[starting,setStarting]=useState(false);
  const recording=useRef<Awaited<ReturnType<typeof startRecording>>|null>(null),recorded=useRef<RecordingDraft|undefined>(undefined);
  const audio=useRef<HTMLAudioElement|null>(null),audioUrl=useRef<string|null>(null),audioRequest=useRef<AbortController|null>(null);
  const openedVersion=useRef(version);
  const SpeechRecognition=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;
  const supportsSpeech='speechSynthesis' in window;
  const preview=interpretVoice(text,clarification||undefined,shipment,clock);
  const active=starting||phase==='speaking'||phase==='listening'||phase==='holding';
  const needsClarification=!!text&&!asked&&!preview.delay&&!preview.frustrated&&preview.voiceIntent!=='human_request'&&preview.capture==='uncaptured'&&preview.outcome!=='refused'&&preview.outcome!=='wrong_number'&&preview.outcome!=='voicemail'&&preview.outcome!=='no_answer';
  const intro=voicePrompts.intro;
  const clarificationId=voiceClarification(text);
  const clarificationPrompt=voicePrompts[clarificationId];
  const canSpeak=output==='browser'?supportsSpeech:!!options?.configured&&!!voiceId;

  function stop(){
    generation.current++;
    if(timer.current)clearTimeout(timer.current);
    if(speechTimer.current)clearTimeout(speechTimer.current);
    audioRequest.current?.abort();audioRequest.current=null;
    holdRequest.current?.abort();holdRequest.current=null;
    if(audio.current){audio.current.onended=null;audio.current.onerror=null;audio.current.pause();audio.current=null;}
    if(audioUrl.current){URL.revokeObjectURL(audioUrl.current);audioUrl.current=null;}
    const r=recognizer.current;recognizer.current=null;
    if(r){r.onend=null;r.onresult=null;r.onerror=null;r.abort();}
    if(supportsSpeech)window.speechSynthesis.cancel();
  }
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;stop();recording.current?.discard();recorded.current=undefined;};},[]);
  useEffect(()=>{let disposed=false;loadVoices().then(result=>{if(disposed)return;setOptions(result);setVoiceId(result.voices[0]?.id||'');}).catch(e=>{if(!disposed)setError(e.message);});return()=>{disposed=true;};},[]);

  async function speak(prompt:VoicePrompt,after?:()=>void){
    const message=voicePrompts[prompt];
    setSampleOnly(prompt==='preview');
    stop();setQuestion(message);setPhase('speaking');
    setError('');
    if(!canSpeak){setError('Connect ElevenLabs and choose a voice, or select the browser voice fallback.');setPhase('review');return;}
    const turn=generation.current;
    const finish=(failure?:string)=>{
      if(!alive.current||turn!==generation.current)return;
      stop();
      if(failure){setError(failure);setPhase('review');}
      else if(after)after();else setPhase('review');
    };
    const failure='Audio playback was unavailable. Try Play voice sample again, use “Speak answer”, or type below.';
    speechTimer.current=setTimeout(()=>finish('Speech timed out. Please try again.'),45000);
    if(output==='elevenlabs'){
      try{
        const controller=new AbortController();audioRequest.current=controller;
        const blob=await generateSpeech(prompt,voiceId,controller.signal);
        if(!alive.current||turn!==generation.current)return;
        audioUrl.current=URL.createObjectURL(blob);const player=new Audio(audioUrl.current);audio.current=player;recording.current?.addBella(player);
        player.onended=()=>finish();player.onerror=()=>finish(failure);
        await player.play();
      }catch(e){finish((e as Error).name==='NotAllowedError'?'Your browser blocked playback. Click Play voice sample to enable audio.':(e as Error).message||failure);}
    }else{
      const utterance=new SpeechSynthesisUtterance(message);utterance.lang='en-US';utterance.rate=1;
      const voices=window.speechSynthesis.getVoices();
      utterance.voice=voices.find(v=>v.lang==='en-US'&&!v.localService)||voices.find(v=>v.lang==='en-US')||null;
      utterance.onend=()=>finish();utterance.onerror=()=>finish(failure);window.speechSynthesis.speak(utterance);
    }
  }

  async function hold(){
    stop();setHandoffChoice('accepted');setHandoff({status:'waiting',messages:[]});setPhase('holding');setQuestion('Simulated hold — open the coordinator desk to continue the practice conversation.');
    const turn=generation.current,controller=new AbortController();holdRequest.current=controller;
    try{await playHoldMusic(controller.signal);}catch{if(turn===generation.current)setError('Hold-music preview could not play. No transfer was attempted.');}
    if(alive.current&&turn===generation.current){stop();setPhase('review');setQuestion('Ready for the coordinator. Open the coordinator desk and join the practice conversation.');}
  }
  function acceptHandoff(){setHandoffChoice('accepted');setReviewed(false);speak('hold_demo',()=>{void hold();});}

  function listen(followup=false,first=text,handoff=false){
    if(!consent||!SpeechRecognition){setError('Enable microphone use in a supported browser, or type a demo answer.');return;}
    stop();setSampleOnly(false);setError('');setInterim('');setReviewed(false);setPhase('listening');
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
      setUsedMic(true);setHeard(previous=>previous+(previous?'\n':'')+(handoff?'Handoff response: ':followup?'Clarification: ':'Carrier: ')+answer);
      if(handoff){
        if(/\b(?:no|not now|don't|do not)\b/i.test(answer)){setHandoffChoice('declined');speak('handoff_declined');}
        else if(/\b(?:yes|please|okay|ok|sure|connect|transfer)\b/i.test(answer))acceptHandoff();
        else setQuestion('Handoff response was unclear. No transfer has been attempted. Choose a demo option below.');
        return;
      }
      if(followup)setClarification(answer);else {setText(answer);setClarification('');}
      const result=interpretVoice(followup?first:answer,followup?answer:undefined,shipment,clock);
      if(!followup&&!result.delay&&!result.frustrated&&result.voiceIntent!=='human_request'&&result.capture==='uncaptured'&&['ambiguous','eta_incomplete'].includes(result.outcome)){
        setAsked(true);speak(voiceClarification(answer),()=>listen(true,answer));
      }else{
        const reply=callerReply(result),offer=reply.endsWith('_handoff');
        setHandoffOffered(offer);speak(reply,offer?()=>listen(false,followup?first:answer,true):undefined);
      }
    };
    // Bound microphone time even if a recognition engine never emits an end event.
    timer.current=setTimeout(()=>{if(turn===generation.current){stop();setPhase('review');setInterim('');setError('Listening timed out. No partial transcript was saved. Try again or record no answer.');}},25000);
    try{r.start();}catch{stop();setPhase('review');setError('Could not start recognition. Try Chrome with microphone access, or type below.');}
  }

  function edit(value:string,followup=false){
    setReviewed(false);setHandoffOffered(false);setHandoffChoice(undefined);setHandoff(null);requestId.current=crypto.randomUUID();
    if(followup)setClarification(value);else setText(value);
  }
  async function begin(){
   setError('');setStarting(true);
   try{if(recordConsent&&audioHistory){const capture=await startRecording(output==='elevenlabs',()=>{if(alive.current){setRecordingActive(false);setError('Recording reached its five-minute or size limit. You can still review and save the captured audio.');}});if(!alive.current){capture.discard();return;}recording.current=capture;setRecordingActive(true);}if(alive.current){setStarting(false);void speak('intro',()=>listen());}}
   catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setStarting(false);}
  }
  if(coordinatorScreen&&handoff)return <div className="voice-demo">{recordingActive&&<p role="status">Microphone recording is still on. Typed replies are saved as text.</p>}<CoordinatorHandoff shipment={shipment} result={preview} transcript={heard||text+(clarification?'\n'+clarification:'')} session={handoff} onChange={session=>{setHandoff(session);setReviewed(false);}} onBack={()=>setCoordinatorScreen(false)}/></div>;
  return <div className="voice-demo">
    <div className="voice-badge"><Mic size={16}/>Talk with Bella <span className="sim-label">SIMULATED</span></div>
    <p>You play the carrier. The agent asks aloud, listens, and proposes a result. <strong>Nothing is saved until you review it.</strong></p>
    <p className="hint">Guided speech demo with rule-based ETA interpretation, not an open-ended AI conversation. Use fictional details only. IST means India Standard Time (Asia/Kolkata) in this demo. “Today” and “tomorrow” use the demo clock: {new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:shipment.windowTz}).format(new Date(clock))}.</p>
    <div className="voice-settings">
      <label>Agent audio<select aria-label="Agent audio" value={output} disabled={active||busy} onChange={e=>{setOutput(e.target.value);setError('');}}><option value="elevenlabs">ElevenLabs · natural voice</option><option value="browser">Browser voice · basic fallback</option></select></label>
      {output==='elevenlabs'&&<>{options?.configured?<><label>Voice<select aria-label="Agent voice" value={voiceId} disabled={active||busy} onChange={e=>setVoiceId(e.target.value)}>{options.voices.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><p className="hint">{options.voices.find(v=>v.id===voiceId)?.description||'No voices available. Add a voice in ElevenLabs, then reopen this demo.'}</p><small>Previewing a new voice uses ElevenLabs credits. Only generic agent prompts are sent to ElevenLabs.</small></>:<p className="voice-warning">{options?'ElevenLabs is not connected yet. Add your API key locally and restart the app to enable natural speech.':'Loading available voices…'}</p>}</>}
      {output==='browser'&&<p className="hint">Basic system voice. Quality depends on your browser and device.</p>}
      <p className="hint">Voice sample only: Bella will not listen here. To talk, enable your microphone below and choose Start conversation.</p><button disabled={busy||active||!canSpeak||!!recording.current} onClick={()=>speak('preview')}><Volume2 size={17}/>Play voice sample</button>
    </div>
    {!SpeechRecognition&&<div className="voice-warning">Speech recognition is unavailable in this browser. Open this app in Chrome for microphone input. You can still type an answer here; it will be labelled “typed demo”.</div>}
    <label className="voice-consent"><input type="checkbox" checked={consent} disabled={active||busy} onChange={e=>setConsent(e.target.checked)}/><span>Use my microphone for this demo. My browser may send audio to its speech-recognition service. The transcript is saved only after I review it. Audio recording is a separate choice below.</span></label>
    {audioHistory?<label className="voice-consent"><input type="checkbox" checked={recordConsent} disabled={active||busy||!!text||!!recording.current} onChange={e=>setRecordConsent(e.target.checked)}/><span>Also record this practice conversation. I consent to sharing the recording with this workspace for seven days when I save. {output==='elevenlabs'?'My microphone and Bella are captured.':'Only my microphone is captured with the browser voice.'} Hold music and typed replies are not captured.</span></label>:<small>Audio history is not enabled. This conversation will save reviewed text only.</small>}
    {recordingActive&&<div className="recording-status" role="status">Recording microphone{output==='elevenlabs'?' and Bella':''} <button onClick={async()=>{try{recorded.current=await recording.current?.stop();}catch(e){setError((e as Error).message);}setRecordingActive(false);}}>Stop recording</button></div>}
    {recording.current&&<button disabled={busy} onClick={()=>{recording.current?.discard();recording.current=null;recorded.current=undefined;setRecordingActive(false);setRecordConsent(false);}}>Discard audio · keep transcript</button>}
    <div className="voice-controls">
      <button className="primary" disabled={busy||active||!consent||!SpeechRecognition||!!text||!canSpeak} onClick={begin}><Mic size={17}/>Start conversation</button>
      {active&&<button onClick={()=>{stop();setPhase('review');setInterim('');}}><Square size={16}/>Stop audio</button>}
    </div>
    <div className={'voice-agent '+(active?'active':'')} aria-live="polite"><span className="voice-orb"><Mic size={25}/></span><div><strong>{phase==='holding'?'Simulated hold music…':phase==='listening'?'Listening to your answer…':phase==='speaking'?(sampleOnly?'Playing sample · microphone off':'Bella speaking · wait to reply'):sampleOnly?'Voice sample finished · microphone off':'Ready · not listening for a reply'}</strong><p>{question||intro}</p>{interim&&<p className="voice-interim">Heard so far: {interim}</p>}</div></div>
    {handoffOffered&&!handoff&&<div className="voice-warning"><strong>Continue with a coordinator</strong><p>In this simulation, you can switch to the coordinator screen, join the conversation and reply. No phone transfer takes place.</p><div className="voice-controls"><button disabled={active||busy||!canSpeak} onClick={acceptHandoff}>Yes · try handoff</button><button disabled={active||busy||!canSpeak} onClick={()=>{setHandoffChoice('declined');speak('handoff_declined');}}>No · end conversation</button></div></div>}
    {handoff&&<section className="handoff-panel"><strong>{handoff.status==='joined'?'Coordinator joined · simulated':handoff.status==='ended'?'Practice conversation ended':'Waiting for coordinator · simulated'}</strong><p>You can play both sides. Open the coordinator desk to join and respond.</p><button disabled={busy||phase==='speaking'||phase==='listening'} onClick={()=>{stop();setPhase('review');setCoordinatorScreen(true);}}>Open coordinator desk</button>{handoff.messages.length>0&&<ol className="handoff-messages">{handoff.messages.map((m,i)=><li key={i}><strong>{m.role==='coordinator'?'Coordinator':'Caller'} · simulated</strong><p>{m.text}</p></li>)}</ol>}{handoff.status==='joined'&&<><label className="voice-field">Caller message<textarea maxLength={2000} value={callerMessage} onChange={e=>setCallerMessage(e.target.value)}/></label><button disabled={!callerMessage.trim()||handoff.messages.length>=20} onClick={()=>{setHandoff({...handoff,messages:[...handoff.messages,{role:'caller',text:callerMessage.trim()}]});setCallerMessage('');setReviewed(false);}}>Send caller message</button></>}</section>}
    {error&&<div className="error" role="alert">{error}</div>}
    <h3>Coordinator review · not spoken to the caller</h3>
    <label className="voice-field">Carrier answer<textarea aria-label="Carrier answer" rows={3} maxLength={4000} disabled={active||busy} value={text} onChange={e=>edit(e.target.value)} placeholder="For example: November 11, 2026 at three thirty PM Central Time"/></label>
    <div className="voice-controls"><button disabled={busy||active||!consent||!SpeechRecognition||asked} onClick={()=>listen()}>Speak answer</button><button disabled={busy||active||!!text} onClick={()=>{edit('[No response heard]');setPhase('review');}}>Record no answer</button></div>
    {(asked||needsClarification)&&<div className="voice-followup"><p><strong>One clarification:</strong> {clarificationPrompt}</p><label className="voice-field">Clarification answer<textarea aria-label="Clarification answer" rows={2} maxLength={2000} disabled={active||busy} value={clarification} onChange={e=>{setAsked(true);edit(e.target.value,true);}}/></label><button disabled={busy||active||asked||!SpeechRecognition||!consent||!canSpeak} onClick={()=>{setAsked(true);speak(clarificationId,()=>listen(true));}}>Ask clarification aloud</button></div>}
    {text&&<div className={'voice-preview '+(preview.reasons.length?'needs-review':'')} aria-live="polite"><strong>{preview.reasons.length?<><AlertTriangle size={16}/>Human review required</>:<><Check size={16}/>ETA ready for review</>}</strong><p>{preview.instant?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:preview.tz||shipment.windowTz}).format(new Date(preview.instant))+' · '+(preview.tz||shipment.windowTz):'No confirmed ETA will be recorded.'}</p><p>{preview.reasons.length?preview.reasons.join(', ').replaceAll('_',' '):'Carrier-reported estimate in this simulated conversation.'}</p>{['wrong_number','refused'].includes(preview.outcome)&&<p>The fictional contact will be suppressed until a coordinator reviews it.</p>}<small>{usedMic?'Browser voice transcript':'Typed demo answer'} · {preview.capture==='captured'?'Captured estimate':'Unconfirmed'} · saving creates a simulated check and audit history.</small></div>}
    <label className="voice-consent"><input type="checkbox" checked={reviewed} disabled={!text||active||busy} onChange={e=>setReviewed(e.target.checked)}/><span>I reviewed the transcript, proposed result and any practice replies.{recording.current?' Save the consented recording with this conversation.':''}</span></label>
    <button className="primary voice-save" disabled={!reviewed||!text||active||busy} onClick={async()=>{if(saving.current)return;saving.current=true;try{if(recording.current&&!recorded.current){recorded.current=await recording.current.stop();setRecordingActive(false);}await onSave({type:'voice_demo',requestId:requestId.current,expectedVersion:openedVersion.current,shipmentId:shipment.id,text,clarification:clarification||undefined,heard,reviewed:true,handoffChoice,handoffSession:handoff||undefined,inputMethod:usedMic?'browser_voice':'typed_demo'},recorded.current);}catch(e){setError((e as Error).message);}finally{saving.current=false;}}}>{busy?'Saving…':'Save reviewed conversation'}<Check size={16}/></button>
    <small>Closing discards this unsaved conversation. Delays and uncertainty enter the human queue when you save; the agent never negotiates or calls anyone.</small>
  </div>;
}
