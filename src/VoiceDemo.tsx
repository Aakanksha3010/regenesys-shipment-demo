import {useEffect,useRef,useState} from 'react';
import {Mic,Square,Volume2,Check,AlertTriangle} from 'lucide-react';
import {interpretVoice,withHandoffNotes,type Shipment,type Action} from './domain';
import {voicePrompts,type VoicePrompt,type VoiceOptions} from './voice-prompts';
import {voiceClarification,callerReply,spokenEtaDetails} from './voice-language';
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
type ReplyContext={followup:boolean;first:string;handoff:boolean;previousClarification:string};
type SpeechWindow = Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};

export function VoiceDemo({shipment,clock,version,busy,onSave,loadVoices,generateSpeech,audioHistory=false}:{shipment:Shipment;clock:string;version:number;busy:boolean;onSave:(a:Omit<Action,'requestId'>,recording?:RecordingDraft)=>Promise<boolean>;loadVoices:()=>Promise<VoiceOptions>;generateSpeech:(prompt:VoicePrompt,voiceId:string,signal:AbortSignal)=>Promise<Blob>;audioHistory?:boolean}){
  const [consent,setConsent]=useState(false),[phase,setPhase]=useState<'ready'|'speaking'|'listening'|'holding'|'review'>('ready');
  const [text,setText]=useState(''),[clarification,setClarification]=useState(''),[heard,setHeard]=useState('');
  const [question,setQuestion]=useState(''),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false);
  const [sampleOnly,setSampleOnly]=useState(false);
  const [pendingReply,setPendingReply]=useState<ReplyContext|null>(null),[replyDraft,setReplyDraft]=useState('');
  const [asked,setAsked]=useState(false),[usedMic,setUsedMic]=useState(false),[interim,setInterim]=useState('');
  const recognizer=useRef<Recognition|null>(null),alive=useRef(true),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const quietTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
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
  const preview=withHandoffNotes(interpretVoice(text,clarification||undefined,shipment,clock),handoff?.messages.filter(m=>m.role==='caller').map(m=>m.text)||[]);
  const known=spokenEtaDetails(text+' '+clarification);
  const reasonLabels:Record<string,string>={delay_reported:'A delay was reported.',eta_after_window:'The reported estimate falls after the delivery window.',ambiguous:'The arrival details are still uncertain.',incomplete_eta:'The arrival date, time or time zone is still incomplete.',range_or_conflict:'The arrival details contain a range or conflicting values.',human_requested:'The caller asked for a human agent.',caller_frustrated:'The caller needs help from the team.',wrong_number:'The number does not belong to the intended contact.',refused:'The contact declined to provide an update.',unanswered:'No response was received.',voicemail:'The call reached voicemail.',dropped:'The conversation ended before the details could be established.'};
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
    if(quietTimer.current)clearTimeout(quietTimer.current);
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
  function acceptHandoff(){setPendingReply(null);setHandoffChoice('accepted');setReviewed(false);speak('hold_demo',()=>{void hold();});}

  function askAndListen(prompt:VoicePrompt,context:ReplyContext){
    setPendingReply(context);setReplyDraft('');
    speak(prompt,()=>{if(consent&&SpeechRecognition)listen(context.followup,context.first,context.handoff,context.previousClarification);else setPhase('review');});
  }
  function respond(answer:string,context:ReplyContext,typed=false){
    const {followup,first,handoff,previousClarification}=context;
    setPendingReply(null);setReplyDraft('');setReviewed(false);setError('');
      if(!typed)setUsedMic(true);setHeard(previous=>(previous+(previous?'\n':'')+(typed?'Typed reply: ':handoff?'Handoff response: ':followup?'Clarification: ':'Carrier: ')+answer).slice(-6000));
      if(handoff){
        if(/\b(?:no|not now|don't|do not)\b/i.test(answer)){setHandoffChoice('declined');speak('handoff_declined');}
        else if(/\b(?:yes|please|okay|ok|sure|connect|transfer)\b/i.test(answer))acceptHandoff();
        else setQuestion('Handoff response was unclear. No transfer has been attempted. Choose a demo option below.');
        return;
      }
      const combined=(previousClarification?previousClarification+'; '+answer:answer).slice(0,2000);
      if(followup)setClarification(combined);else {setText(answer);setClarification('');}
      const result=interpretVoice(followup?first:answer,followup?combined:undefined,shipment,clock);
      const details=spokenEtaDetails(first+' '+combined);
      // One bounded repair for a relative timezone answer; never assume the agent's zone.
      if(followup&&!previousClarification&&!result.delay&&!result.frustrated&&result.voiceIntent!=='human_request'&&result.capture==='uncaptured'&&details.date&&details.time&&!details.zone&&/\bsame\s+(?:time\s*zone|zone)\b|\btexas\b/i.test(answer)){
        askAndListen(/\btexas\b/i.test(answer)?'ask_texas_timezone':'ask_timezone_explicit',{followup:true,first,handoff:false,previousClarification:combined});return;
      }
      if(!followup&&!result.delay&&!result.frustrated&&result.voiceIntent!=='human_request'&&result.capture==='uncaptured'&&['ambiguous','eta_incomplete'].includes(result.outcome)){
        setAsked(true);askAndListen(voiceClarification(answer),{followup:true,first:answer,handoff:false,previousClarification:''});
      }else{
        const reply=callerReply(result),offer=reply.endsWith('_handoff');
        setHandoffOffered(offer);if(offer)askAndListen(reply,{followup:false,first:followup?first:answer,handoff:true,previousClarification:''});else speak(reply);
      }
  }
  function finishWithoutReply(){
    if(!pendingReply)return;
    const context=pendingReply;stop();setPendingReply(null);setReplyDraft('');setError('');setReviewed(false);setPhase('review');
    setHeard(previous=>(previous+'\n[Reply not captured; user ended this turn]').slice(-6000));
    if(!context.followup&&!context.handoff)setText('[No response heard]');
    if(context.handoff){setHandoffOffered(false);speak('handoff_declined');}else speak('escalation');
  }
  function listen(followup=false,first=text,handoff=false,previousClarification=''){
    const context={followup,first,handoff,previousClarification};setPendingReply(context);setReplyDraft('');
    if(!consent||!SpeechRecognition){setError('Enable microphone use in a supported browser, or type your reply below.');return;}
    stop();setSampleOnly(false);setError('');setInterim('');setReviewed(false);setPhase('listening');
    const r=new SpeechRecognition();recognizer.current=r;
    const turn=generation.current;let finalText='',interimText='',failed=false;
    const current=()=>turn===generation.current&&alive.current&&recognizer.current===r;
    function recover(message:string){
      const draft=(finalText+interimText).trim().slice(0,2000);
      stop();setPhase('review');setInterim('');setReplyDraft(draft);setError(message);
    }
    r.lang='en-US';r.continuous=true;r.interimResults=true;
    r.onresult=event=>{
      if(!current())return;
      interimText='';finalText='';
      for(let i=0;i<event.results.length;i++){
        const result=event.results[i];
        if(result.isFinal)finalText+=result[0].transcript+' ';else interimText+=result[0].transcript+' ';
      }
      setInterim((finalText+interimText).trim());
      if(quietTimer.current)clearTimeout(quietTimer.current);
      if(finalText.trim()&&!interimText.trim())quietTimer.current=setTimeout(()=>{if(current())r.stop();},1800);
    };
    r.onerror=event=>{
      if(!current())return;failed=true;
      recover(event.error==='not-allowed'||event.error==='service-not-allowed'?'Microphone or speech-service access was denied. Allow access in your browser, or type your reply below.':'The microphone could not capture a complete reply. Try again or type below.');
    };
    r.onend=()=>{
      if(!current())return;
      if(failed||!finalText.trim()||interimText.trim()){
        recover(interimText.trim()?'Some words were not finalized. Check the draft reply below before continuing.':'No reply was captured. Try the microphone again or type below.');return;
      }
      const answer=finalText.trim();stop();setInterim('');setPhase('review');respond(answer,context);
    };
    timer.current=setTimeout(()=>{
      if(!current())return;
      // A finalized answer may exist even when the browser never emits onend.
      if(finalText.trim()&&!interimText.trim()&&!failed)r.onend?.();
      else recover('Listening timed out. Your earlier details are kept. Retry the microphone or check and send a typed reply below.');
    },25000);
    try{r.start();}catch{recover('Could not start recognition. Try the microphone again or type your reply below.');}
  }

  function edit(value:string,followup=false){
    setPendingReply(null);setReplyDraft('');setError('');setReviewed(false);setHandoffOffered(false);setHandoffChoice(undefined);setHandoff(null);requestId.current=crypto.randomUUID();
    if(followup)setClarification(value);else setText(value);
  }
  async function begin(){
   setError('');setStarting(true);
   try{if(recordConsent&&audioHistory){const capture=await startRecording(output==='elevenlabs',()=>{if(alive.current){setRecordingActive(false);setError('Recording reached its five-minute or size limit. You can still review and save the captured audio.');}});if(!alive.current){capture.discard();return;}recording.current=capture;setRecordingActive(true);}if(alive.current){setStarting(false);askAndListen('intro',{followup:false,first:'',handoff:false,previousClarification:''});}}
   catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setStarting(false);}
  }
  if(coordinatorScreen&&handoff)return <div className="voice-demo">{recordingActive&&<p role="status">Microphone recording is still on. Typed replies are saved as text.</p>}<CoordinatorHandoff shipment={shipment} clock={clock} result={preview} transcript={heard||text+(clarification?'\n'+clarification:'')} session={handoff} onChange={session=>{setHandoff(session);setReviewed(false);}} onBack={()=>setCoordinatorScreen(false)} onSpeak={prompt=>{void speak(prompt);}} onStop={()=>{stop();setPhase('review');}} speaking={phase==='speaking'} audioError={error} recordingActive={recordingActive}/></div>;
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
    {recording.current&&<button disabled={busy} onClick={()=>{recording.current?.discard();recording.current=null;recorded.current=undefined;setRecordingActive(false);setRecordConsent(false);}}>Discard recording</button>}
    <div className="voice-controls">
      <button className="primary" disabled={busy||active||!consent||!SpeechRecognition||!!text||!canSpeak} onClick={begin}><Mic size={17}/>Start conversation</button>
      {!text&&!pendingReply&&!active&&<button disabled={busy} onClick={()=>{setQuestion(intro);setPendingReply({followup:false,first:'',handoff:false,previousClarification:''});setPhase('review');}}>Type a practice reply</button>}
      {phase==='listening'&&<button onClick={()=>recognizer.current?.stop()}>Finish speaking</button>}
      {active&&<button onClick={()=>{stop();setPhase('review');setInterim('');}}><Square size={16}/>Stop audio</button>}
    </div>
    <div className={'voice-agent '+(active?'active':'')} aria-live="polite"><span className="voice-orb"><Mic size={25}/></span><div><strong>{phase==='holding'?'Simulated hold music…':phase==='listening'?'Listening to your answer…':phase==='speaking'?(sampleOnly?'Playing sample · microphone off':'Bella speaking · wait to reply'):sampleOnly?'Voice sample finished · microphone off':'Ready · not listening for a reply'}</strong><p>{question||intro}</p>{interim&&<p className="voice-interim">Heard so far: {interim}</p>}</div></div>
    {handoffOffered&&!handoff&&<div className="voice-warning"><strong>Continue with a coordinator</strong><p>In this simulation, you can switch to the coordinator screen, join the conversation and reply. No phone transfer takes place.</p><div className="voice-controls"><button disabled={active||busy||!canSpeak} onClick={acceptHandoff}>Yes · try handoff</button><button disabled={active||busy||!canSpeak} onClick={()=>{setPendingReply(null);setHandoffChoice('declined');speak('handoff_declined');}}>No · end conversation</button></div></div>}
    {handoff&&<section className="handoff-panel"><strong>{handoff.status==='joined'?'Coordinator joined · simulated':handoff.status==='ended'?'Practice conversation ended':'Waiting for coordinator · simulated'}</strong><p>Open the coordinator desk to continue with automatic scripted replies, or choose manual roleplay.</p><button disabled={busy||phase==='speaking'||phase==='listening'} onClick={()=>{stop();setPhase('review');setCoordinatorScreen(true);}}>Open coordinator desk</button>{handoff.messages.length>0&&<ol className="handoff-messages">{handoff.messages.map((m,i)=><li key={i}><strong>{m.role==='coordinator'?'Coordinator':'Caller'} · simulated</strong><p>{m.text}</p></li>)}</ol>}{handoff.status==='joined'&&handoff.interaction!=='automatic'&&<><label className="voice-field">Caller message<textarea maxLength={2000} value={callerMessage} onChange={e=>setCallerMessage(e.target.value)}/></label><button disabled={!callerMessage.trim()||handoff.messages.length>=20} onClick={()=>{setHandoff({...handoff,messages:[...handoff.messages,{role:'caller',text:callerMessage.trim()}]});setCallerMessage('');setReviewed(false);}}>Send caller message</button></>}</section>}
    {error&&<div className="error" role="alert">{error}</div>}
    {pendingReply&&!active&&<section className="voice-followup" aria-label="Continue your reply"><h3>Continue your reply</h3><p>Your earlier details are kept: {[known.date,known.time,known.zone].filter(Boolean).join(' · ')||'No arrival details captured yet.'}</p><p>Reply to the question above. Unfinished words below are a draft, not a confirmed answer.</p><label>Your reply<textarea aria-label="Your reply" maxLength={2000} value={replyDraft} onChange={e=>setReplyDraft(e.target.value)} disabled={busy}/></label><div className="voice-controls"><button disabled={busy||!consent||!SpeechRecognition} onClick={()=>listen(pendingReply.followup,pendingReply.first,pendingReply.handoff,pendingReply.previousClarification)}>Retry microphone</button><button disabled={busy||!replyDraft.trim()} onClick={()=>respond(replyDraft.trim(),pendingReply,true)}>Continue with this reply</button><button disabled={busy} onClick={finishWithoutReply}>End without a reply</button></div></section>}
    <details className="voice-details"><summary>Conversation details (optional)</summary><p>Open these details only if you want to type a response or correct what was heard. The conversation is retained in history when you save.</p>
    <label className="voice-field">Carrier answer<textarea aria-label="Carrier answer" rows={3} maxLength={4000} disabled={active||busy} value={text} onChange={e=>edit(e.target.value)} placeholder="For example: November 11, 2026 at three thirty PM Central Time"/></label>
    <div className="voice-controls"><button disabled={busy||active||!consent||!SpeechRecognition||asked} onClick={()=>listen()}>Speak answer</button><button disabled={busy||active||!!text} onClick={()=>{edit('[No response heard]');setPhase('review');}}>Record no answer</button></div>
    {(asked||needsClarification)&&<div className="voice-followup"><p><strong>Clarification:</strong> {clarificationPrompt}</p><label className="voice-field">Clarification answer<textarea aria-label="Clarification answer" rows={2} maxLength={2000} disabled={active||busy} value={clarification} onChange={e=>{setAsked(true);edit(e.target.value,true);}}/></label><button disabled={busy||active||asked||!SpeechRecognition||!consent||!canSpeak} onClick={()=>{setAsked(true);askAndListen(clarificationId,{followup:true,first:text,handoff:false,previousClarification:''});}}>Ask clarification aloud</button></div>}
    </details>
    {text&&(!pendingReply||pendingReply.handoff)&&<div className={'voice-preview '+(preview.reasons.length?'needs-review':'')} aria-live="polite"><strong>{preview.reasons.length?<><AlertTriangle size={16}/>Ready to forward to our human agent team</>:<><Check size={16}/>Arrival estimate ready</>}</strong><p>{preview.instant?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:preview.tz||shipment.windowTz}).format(new Date(preview.instant))+' · '+(preview.tz||shipment.windowTz):'Arrival estimate not yet established.'}</p>{!preview.instant&&(known.date||known.time)&&<p>Details heard: {[known.date,known.time,known.zone].filter(Boolean).join(' · ')}. These details are not yet a complete arrival estimate.</p>}<p>{preview.reasons.length?preview.reasons.map(r=>reasonLabels[r]||r.replaceAll('_',' ')).join(' '):'Carrier-reported estimate in this simulated conversation.'}</p>{!preview.delay&&!preview.reasons.includes('eta_after_window')&&preview.reasons.some(r=>['ambiguous','incomplete_eta','range_or_conflict'].includes(r))&&<p>No delay was reported. The team will help clarify the arrival details.</p>}{['wrong_number','refused'].includes(preview.outcome)&&<p>The fictional contact will be suppressed until a coordinator reviews it.</p>}<small>{preview.reasons.length?'Saving forwards this to the shared human-team queue in this demo.':'Save to keep this estimate in the shipment history.'}</small></div>}
    <label className="voice-consent"><input type="checkbox" checked={reviewed} disabled={!text||active||busy||(!!pendingReply&&!pendingReply.handoff)} onChange={e=>setReviewed(e.target.checked)}/><span>I checked the outcome and any practice replies.{recording.current?' Save the consented recording with this conversation.':''}</span></label>
    <button className="primary voice-save" disabled={!reviewed||!text||active||busy||(!!pendingReply&&!pendingReply.handoff)} onClick={async()=>{if(saving.current)return;saving.current=true;try{if(recording.current&&!recorded.current){recorded.current=await recording.current.stop();setRecordingActive(false);}await onSave({type:'voice_demo',requestId:requestId.current,expectedVersion:openedVersion.current,shipmentId:shipment.id,text,clarification:clarification||undefined,heard,reviewed:true,handoffChoice,handoffSession:handoff||undefined,inputMethod:usedMic?'browser_voice':'typed_demo'},recorded.current);}catch(e){setError((e as Error).message);}finally{saving.current=false;}}}>{busy?(preview.reasons.length?'Forwarding to our human agent team…':'Saving…'):preview.reasons.length?'Save and forward to human team':'Save reviewed conversation'}<Check size={16}/></button>
    <small>Closing discards this unsaved conversation. Delays and uncertainty enter the human queue when you save; the agent never negotiates or calls anyone.</small>
  </div>;
}
