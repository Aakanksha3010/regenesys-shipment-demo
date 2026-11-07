import {voicePrompts,type VoicePrompt,type VoiceOption} from '../src/voice-prompts.js';

export class VoiceError extends Error {constructor(message:string,public status=503){super(message);}}
// Server-only adapter. Bounded, cached, generic speech; never forwards arbitrary client text.
export function createVoiceService(key:string|undefined,fetcher:typeof fetch=fetch){
 const configured=!!key?.trim();
 let voices:VoiceOption[]=[];let voicesUntil=0;let listing:Promise<VoiceOption[]>|undefined;
 const cache=new Map<string,Buffer>(),pending=new Map<string,Promise<Buffer>>();
 const calls:number[]=[];
 function required(){if(!configured)throw new VoiceError('ElevenLabs is not connected yet. Add ELEVENLABS_API_KEY to app/.env and restart the app.');}
 async function request(url:string,init:RequestInit={}){
  required();
  let response:Response;
  try{response=await fetcher('https://api.elevenlabs.io'+url,{...init,headers:{'xi-api-key':key!,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});}catch{throw new VoiceError('ElevenLabs could not be reached. Please try again.');}
  if(!response.ok){
   const body=await response.json().catch(()=>null);
   if(body?.detail?.status==='api_key_id_used_as_api_key')throw new VoiceError('The saved value is an ElevenLabs key ID. Replace it with the full secret API key shown when you create a key.');
   if(response.status===401||response.status===403)throw new VoiceError('Check the ElevenLabs key and its Text to Speech and Voices permissions.');
   if(response.status===429)throw new VoiceError('ElevenLabs usage or rate limit reached. Check your available credits, then try again.',429);
   throw new VoiceError('ElevenLabs could not generate this voice. Try another voice or check your account.');
  }
  return response;
 }
 async function list():Promise<VoiceOption[]>{
  required();if(Date.now()<voicesUntil)return voices;
  if(listing)return listing;
  listing=(async()=>{const response=await request('/v2/voices?page_size=100');const data=await response.json();
   if(!Array.isArray(data.voices))throw new VoiceError('ElevenLabs returned an unexpected voice list.');
   voices=data.voices.filter((v:any)=>typeof v.voice_id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v.voice_id)&&typeof v.name==='string').map((v:any)=>({id:v.voice_id,name:v.name.slice(0,120),description:String(v.description||Object.values(v.labels||{}).join(' · ')).slice(0,300)}));
   const score=(v:VoiceOption)=>{const text=(v.name+' '+v.description).toLowerCase();return ['warm','conversational','bright','clear','natural','friendly'].reduce((n,word,i)=>n+(text.includes(word)?[4,3,2,2,2,1][i]:0),0);};
   voices.sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name));voicesUntil=Date.now()+300000;return voices;
  })();try{return await listing;}finally{listing=undefined;}
 }
 async function speak(prompt:unknown,voiceId:unknown):Promise<Buffer>{
  required();
  if(typeof prompt!=='string'||!Object.hasOwn(voicePrompts,prompt))throw new VoiceError('Choose a supported agent prompt.',400);
  if(typeof voiceId!=='string'||!(await list()).some(v=>v.id===voiceId))throw new VoiceError('Choose an available ElevenLabs voice.',400);
  const id=voiceId+':'+prompt;
  if(cache.has(id))return cache.get(id)!;
  if(pending.has(id))return pending.get(id)!;
  const now=Date.now();while(calls.length&&calls[0]<now-60000)calls.shift();
  if(calls.length>=10||pending.size>=2)throw new VoiceError('Please wait a moment before generating more speech.',429);
  calls.push(now);
  const task=(async()=>{
   const r=await request('/v1/text-to-speech/'+encodeURIComponent(voiceId)+'?output_format=mp3_44100_128',{method:'POST',body:JSON.stringify({text:voicePrompts[prompt as VoicePrompt],model_id:'eleven_multilingual_v2',voice_settings:{stability:0.4,similarity_boost:0.75,style:0.25,use_speaker_boost:true,speed:1.0}})});
   if(!r.headers.get('content-type')?.startsWith('audio/'))throw new VoiceError('ElevenLabs did not return playable audio.');
   const audio=Buffer.from(await r.arrayBuffer());
   if(!audio.length||audio.length>2_000_000)throw new VoiceError('ElevenLabs returned an invalid audio clip.');
   if(cache.size>=30)cache.delete(cache.keys().next().value!);cache.set(id,audio);return audio;
  })();pending.set(id,task);try{return await task;}finally{pending.delete(id);}
 }
 return {configured,list,speak};
}
