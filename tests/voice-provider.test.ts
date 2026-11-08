import {test as nodeTest,after} from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
const results:{name:string;passed:boolean}[]=[];
function test(name:string,fn:()=>Promise<void>){nodeTest(name,async()=>{try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false});throw e;}});}
after(async()=>{await mkdir('validation',{recursive:true});await writeFile('validation/provider-results.json',JSON.stringify({tests:results},null,2));});
import assert from 'node:assert/strict';
import {createVoiceService} from '../server/voice.js';
import {voicePrompts} from '../src/voice-prompts.js';

const voices={voices:[{voice_id:'demoVoice',name:'Warm voice',description:'Friendly, clear and conversational'}]};
test('provider remains disabled without a key and never contacts ElevenLabs',async()=>{
 let requests=0;const service=createVoiceService(undefined,async()=>{requests++;throw Error('unexpected');});
 assert.equal(service.configured,false);await assert.rejects(service.list(),/not connected/);assert.equal(requests,0);
});
test('provider sends only allowed prompts and caches concurrent speech requests',async()=>{
 const requests:{url:string;init?:RequestInit}[]=[];
 const service=createVoiceService('test-only-not-a-real-key',async(url,init)=>{requests.push({url:String(url),init});return String(url).includes('/voices')?Response.json(voices):new Response('test-audio',{headers:{'Content-Type':'audio/mpeg'}});});
 const [one,two]=await Promise.all([service.speak('preview','demoVoice'),service.speak('preview','demoVoice')]);
 assert.deepEqual(one,two);assert.equal(requests.length,2);assert.equal(JSON.parse(String(requests[1].init?.body)).text,voicePrompts.preview);
 await service.speak('preview','demoVoice');assert.equal(requests.length,2);
 await assert.rejects(service.speak('private transcript','demoVoice'),/supported agent prompt/);
 await assert.rejects(service.speak('__proto__','demoVoice'),/supported agent prompt/);
 await assert.rejects(service.speak('intro','https://attacker.test'),/available ElevenLabs voice/);assert.equal(requests.length,2);
});
test('provider failures are sanitized and never expose credentials or raw response',async()=>{
 for(const status of [401,403,429,500]){
  const service=createVoiceService('secret-marker',async()=>new Response('secret-marker private upstream error',{status}));
  await assert.rejects(service.list(),e=>e instanceof Error&&!e.message.includes('secret-marker')&&!e.message.includes('private upstream'));
 }
});
test('provider refuses non-audio results and permits retry after failure',async()=>{
 let generation=0;const service=createVoiceService('test-only',async(url)=>String(url).includes('/voices')?Response.json(voices):++generation===1?Response.json({message:'unexpected'}):new Response('audio',{headers:{'Content-Type':'audio/mpeg'}}));
 await assert.rejects(service.speak('intro','demoVoice'),/playable audio/);
 assert.equal((await service.speak('intro','demoVoice')).toString(),'audio');
});
test('provider bounds request bursts and concurrent generation',async()=>{
 let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});
 const service=createVoiceService('test-only',async(url)=>{if(String(url).includes('/voices'))return Response.json(voices);await barrier;return new Response('audio',{headers:{'Content-Type':'audio/mpeg'}});});
 await service.list();const a=service.speak('intro','demoVoice'),b=service.speak('preview','demoVoice');
 await assert.rejects(service.speak('clarification','demoVoice'),/wait a moment/);release();await Promise.all([a,b]);
});

test('coordinator speech uses generic allowed text without caller details',async()=>{
 const bodies:string[]=[];
 const service=createVoiceService('test-only',async(url,init)=>{if(String(url).includes('/voices'))return Response.json(voices);bodies.push(String(init?.body));return new Response('audio',{headers:{'Content-Type':'audio/mpeg'}});});
 for(const prompt of ['coordinator_intro','coordinator_delay','coordinator_note','coordinator_unclear','coordinator_limit','coordinator_end'] as const){await service.speak(prompt,'demoVoice');assert.equal(JSON.parse(bodies.at(-1)!).text,voicePrompts[prompt]);}
 await assert.rejects(service.speak('we would be 30 minutes late could you review the delivery','demoVoice'),/supported agent prompt/);
});
