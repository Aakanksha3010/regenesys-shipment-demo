import {MAX_AUDIO_BYTES} from '../src/audio-limits.js';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Actor,State} from '../src/domain.js';
export const AUDIO_BUCKET='shipment-demo-audio';
export const RETENTION_MS=7*24*60*60*1000;
export type AudioMeta={id:string;attemptId:string;shipmentId:string;mime:string;createdAt:string;expiresAt:string;coverage:string;consent:true};
export type AudioStorage={put:(id:string,bytes:Buffer,mime:string)=>Promise<void>;get:(id:string)=>Promise<Buffer>;remove:(ids:string[])=>Promise<void>;list:()=>Promise<{id:string;createdAt:string}[]>};
export function audioRecords(state:State):AudioMeta[]{return state.audit.filter(a=>a.action==='conversation_audio_saved').map(a=>(a.details as any).recording as AudioMeta);}
export function recordingPermission(state:State,attemptId:string,actor:Actor,consent:unknown){
 if(actor.role!=='coordinator')throw Error('Only coordinators can save audio.');
 if(consent!=='yes')throw Error('Recording consent is required.');
 const attempt=state.attempts.find(a=>a.id===attemptId),review=state.audit.find(a=>a.entityId===attemptId&&a.action==='voice_demo_reviewed');
 if(!attempt||attempt.inputMethod!=='browser_voice'||review?.actorId!==actor.id)throw Error('Save and review your own voice conversation before attaching audio.');
 return attempt;
}
export function validateAudio(bytes:Buffer,mime:string){
 if(!['audio/webm','audio/mp4','audio/ogg'].includes(mime.split(';')[0])||!bytes.length||bytes.length>MAX_AUDIO_BYTES)throw Error('Use a supported recording under 4 MB.');
 const webm=bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])),ogg=bytes.subarray(0,4).toString()==='OggS',mp4=bytes.subarray(4,8).toString()==='ftyp';
 if(!(mime.startsWith('audio/webm')&&webm||mime.startsWith('audio/ogg')&&ogg||mime.startsWith('audio/mp4')&&mp4))throw Error('The upload is not a supported audio file.');
}
export function metadata(attempt:{id:string;shipmentId:string},mime:string,coverage:string,now=Date.now()):AudioMeta{
 if(!['microphone_and_bella','microphone_only'].includes(coverage))throw Error('Specify what the recording contains.');
 return {id:randomUUID(),attemptId:attempt.id,shipmentId:attempt.shipmentId,mime,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+RETENTION_MS).toISOString(),coverage,consent:true};
}
export function findPlayable(state:State,id:string,now=Date.now()){const record=audioRecords(state).find(r=>r.id===id);if(!record||Date.parse(record.expiresAt)<=now)throw Error('This recording is unavailable or has expired.');return record;}
export async function purgeAudio(storage:AudioStorage,state:State,now=Date.now()){
 const records=new Map(audioRecords(state).map(r=>[r.id,r]));
 const expired=(await storage.list()).filter(file=>{const record=records.get(file.id);return record?Date.parse(record.expiresAt)<=now:Date.parse(file.createdAt)<now-3600000;}).map(f=>f.id);
 if(expired.length)await storage.remove(expired);return expired.length;
}
export async function localAudio(directory:string):Promise<AudioStorage>{
 await mkdir(directory,{recursive:true,mode:0o700});
 const file=(id:string)=>{if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid recording ID.');return path.join(directory,id);};
 return {put:async(id,bytes)=>{await writeFile(file(id),bytes,{flag:'wx',mode:0o600});},get:id=>readFile(file(id)),remove:async ids=>{for(const id of ids)await unlink(file(id)).catch(e=>{if(e.code!=='ENOENT')throw e;});},list:async()=>{const {stat}=await import('node:fs/promises');const ids=(await readdir(directory)).filter(id=>/^[a-f0-9-]{36}$/.test(id));return Promise.all(ids.map(async id=>({id,createdAt:(await stat(file(id))).birthtime.toISOString()})));}};
}
export async function hostedAudio(client:SupabaseClient):Promise<AudioStorage>{
 const {data,error}=await client.storage.getBucket(AUDIO_BUCKET);if(error||!data)throw Error('Private audio storage is not configured.');if(data.public)throw Error('Audio storage must be private.');
 const bucket=client.storage.from(AUDIO_BUCKET);
 return {put:async(id,bytes,mime)=>{const {error}=await bucket.upload(id,bytes,{contentType:mime,upsert:false});if(error)throw Error('Audio could not be stored.');},get:async id=>{const {data,error}=await bucket.download(id);if(error||!data)throw Error('Audio could not be loaded.');return Buffer.from(await data.arrayBuffer());},remove:async ids=>{const {error}=await bucket.remove(ids);if(error)throw Error('Expired audio could not be deleted.');},list:async()=>{const files:{id:string;createdAt:string}[]=[];for(let offset=0;;offset+=100){const {data,error}=await bucket.list('',{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(error)throw Error('Audio cleanup could not read storage.');files.push(...data.filter(f=>f.created_at!==null).map(f=>({id:f.name,createdAt:f.created_at!})));if(data.length<100)break;}return files;}};
}
