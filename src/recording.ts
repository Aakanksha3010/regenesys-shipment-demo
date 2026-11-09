import {MAX_AUDIO_BYTES,RECORDING_STOP_BYTES} from './audio-limits';
// Optional, consented browser recording. Hold music and typed replies are not captured.
export type RecordingDraft={blob:Blob;coverage:'microphone_and_bella'|'microphone_only'};
export async function startRecording(includeBella:boolean,onLimit:()=>void){
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Recording is unavailable in this browser. You can continue without recording.');
 const mic=await navigator.mediaDevices.getUserMedia({audio:true});
 let context:AudioContext|undefined;
 try{
  context=new AudioContext();await context.resume();const destination=context.createMediaStreamDestination();context.createMediaStreamSource(mic).connect(destination);
  const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime)throw Error('This browser has no supported audio recording format.');
  const recorder=new MediaRecorder(destination.stream,{mimeType:mime,audioBitsPerSecond:64000}),chunks:BlobPart[]=[];
  let bytes=0,finished=false,discarded=false,resolve!:(value:RecordingDraft)=>void,reject!:(e:Error)=>void;
  const done=new Promise<RecordingDraft>((ok,fail)=>{resolve=ok;reject=fail;});void done.catch(()=>{});
  const coverage=includeBella?'microphone_and_bella':'microphone_only';
  const cleanup=()=>{mic.getTracks().forEach(t=>t.stop());void context?.close().catch(()=>{});clearTimeout(timer);};
  recorder.ondataavailable=e=>{if(!discarded&&e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>RECORDING_STOP_BYTES){onLimit();if(recorder.state!=='inactive')recorder.stop();}}};
  recorder.onerror=()=>{finished=true;cleanup();reject(Error('Audio recording failed. The conversation can still be saved without audio.'));};
  recorder.onstop=()=>{finished=true;cleanup();if(discarded){chunks.length=0;resolve({blob:new Blob(),coverage});}else if(bytes>MAX_AUDIO_BYTES)reject(Error('This recording is too large to save. Discard the recording to save the conversation without audio.'));else resolve({blob:new Blob(chunks,{type:mime}),coverage});};
  const timer=setTimeout(()=>{onLimit();if(recorder.state!=='inactive')recorder.stop();},300000);
  recorder.start(1000);
  return {addBella(player:HTMLAudioElement){if(includeBella&&!finished){const source=context!.createMediaElementSource(player);source.connect(destination);source.connect(context!.destination);}},
   stop:async()=>{if(recorder.state!=='inactive')recorder.stop();return done;},
   discard:()=>{discarded=true;chunks.length=0;if(recorder.state!=='inactive')recorder.stop();else cleanup();}};
 }catch(e){mic.getTracks().forEach(t=>t.stop());void context?.close().catch(()=>{});throw e;}
}
