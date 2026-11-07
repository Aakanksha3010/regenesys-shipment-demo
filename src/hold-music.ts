// Locally synthesized demo music, not a recording or a real phone queue.
export async function playHoldMusic(signal:AbortSignal):Promise<void>{
 const context=new AudioContext();
 const stop=()=>{void context.close().catch(()=>{});};signal.addEventListener('abort',stop,{once:true});
 try{
  if(signal.aborted)return;await context.resume();if(signal.aborted)return;
  const gain=context.createGain();gain.gain.value=0.055;gain.connect(context.destination);
  const melody=[261.63,329.63,392,329.63,293.66,349.23,440,349.23,261.63,329.63,392,523.25];
  melody.forEach((frequency,i)=>{const note=context.createOscillator(),volume=context.createGain();const start=context.currentTime+i*0.5;note.type='sine';note.frequency.value=frequency;volume.gain.setValueAtTime(0,start);volume.gain.linearRampToValueAtTime(0.6,start+0.05);volume.gain.exponentialRampToValueAtTime(0.001,start+0.45);note.connect(volume);volume.connect(gain);note.start(start);note.stop(start+0.5);});
  await new Promise<void>(resolve=>{const timer=setTimeout(done,6200);function done(){clearTimeout(timer);signal.removeEventListener('abort',done);resolve();}signal.addEventListener('abort',done,{once:true});});
 }finally{signal.removeEventListener('abort',stop);stop();}
}
