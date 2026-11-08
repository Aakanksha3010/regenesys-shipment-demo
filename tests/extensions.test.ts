import {test as nodeTest,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {extractShipment} from '../src/shipment-entry.js';
import {seed,transition,localActor} from '../src/domain.js';
import {localStore} from '../server/store.js';
import {authorize} from '../server/access.js';
import {localAudio,metadata,recordingPermission,validateAudio,findPlayable,purgeAudio,RETENTION_MS} from '../server/audio.js';
const results:{name:string;passed:boolean}[]=[];
function test(name:string,fn:()=>void|Promise<void>){nodeTest(name,async()=>{try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false});throw e;}});}
after(async()=>{await mkdir('validation',{recursive:true});await writeFile('validation/extensions-results.json',JSON.stringify({tests:results},null,2));});
const description='Reference RG 1050. Carrier Northline Freight. Origin Dallas, Texas. Destination Austin, Texas. Delivery date November eleventh, 2026. Window start one PM. Window end five PM. Timezone Central time.';
const voiceAction={type:'voice_demo',requestId:'extension-voice',shipmentId:'shipment-1',expectedVersion:0,text:'We are five hours late',reviewed:true,inputMethod:'browser_voice',handoffChoice:'accepted',handoffSession:{status:'ended',messages:[{role:'coordinator',text:'I can help review the delay.'},{role:'caller',text:'Thank you.'}]}};
test('shipment dictation extracts only explicitly supplied supported fields',()=>{
 const result=extractShipment(description,seed().contacts);assert.deepEqual(result.warnings,[]);
 assert.deepEqual(result.fields,{reference:'RG-1050',origin:'Dallas, Texas',destination:'Austin, Texas',contactId:'contact-1',windowTz:'America/Chicago',windowStart:'2026-11-11T13:00',windowEnd:'2026-11-11T17:00'});
});
test('dictation leaves ambiguous carriers, dates and zones unresolved',()=>{
 const r=extractShipment('Reference RG 1060. Carrier Unknown. Delivery date tomorrow. Window start 3. Timezone same as yours.',seed().contacts);
 assert.equal(r.fields.contactId,undefined);assert.equal(r.fields.windowStart,undefined);assert.ok(!r.fields.windowTz);assert.ok(r.warnings.length>=3);
 assert.equal(extractShipment('Origin Dallas. Origin Austin.',seed().contacts).fields.origin,undefined);
 assert.deepEqual(extractShipment('Maybe origin Dallas.',seed().contacts).fields,{});
});
test('dictation rejects impossible dates and does not silently repair them',()=>{
 const r=extractShipment('Delivery date February 30, 2026. Window start 1 PM. Window end 5 PM.',seed().contacts);assert.equal(r.fields.windowStart,undefined);assert.equal(r.fields.windowEnd,undefined);
});
test('spoken delay detail is separated from destination and preserves uncertainty',()=>{
 for(const clause of ['shipment could be 30 minutes delayed','shipment might be thirty minutes late','the shipment is not delayed']){
  const r=extractShipment('Reference RF 1065 origin Alaska destination Houston '+clause,seed().contacts);
  assert.deepEqual(r.warnings,[]);assert.equal(r.fields.reference,'RF 1065');assert.equal(r.fields.origin,'Alaska');assert.equal(r.fields.destination,'Houston');assert.equal(r.fields.note,clause);assert.equal(r.fields.windowStart,undefined);assert.equal(r.fields.scenarioId,undefined);
 }
 const r=extractShipment('Origin Alaska. Destination Houston and shipment could be 30 minutes delayed. Additional description: driver is waiting for a repair.',seed().contacts);
 assert.equal(r.fields.destination,'Houston');assert.equal(r.fields.note,'shipment could be 30 minutes delayed\ndriver is waiting for a repair');
});
test('plural reference label does not leak an s and an unclear spoken destination is not guessed',()=>{
 const r=extractShipment('take me to shipment references NG 1054 origin is Alaska destination is used in we could be 30 minutes late',seed().contacts);
 assert.equal(r.fields.reference,'NG 1054');assert.equal(r.fields.origin,'Alaska');assert.equal(r.fields.destination,undefined);assert.equal(r.fields.note,'we could be 30 minutes late');assert.deepEqual(r.warnings,['Destination unchanged: "used in" was not a clear place name. Say or type the location before saving.']);
});
test('labels require whole words and reference aliases share duplicate detection',()=>{
 for(const label of ['Reference','References','Shipment reference','Shipment references'])assert.equal(extractShipment(label+' NG 1054',seed().contacts).fields.reference,'NG 1054');
 assert.equal(extractShipment('References NG 1054. Reference NG 1055.',seed().contacts).fields.reference,undefined);
 assert.equal(extractShipment('Referenceable words are not fields.',seed().contacts).fields.reference,undefined);
 assert.equal(extractShipment('Origin Reading. Destination Houston.',seed().contacts).fields.origin,'Reading');
});
test('additional description supports note-only dictation without guessing route fields',()=>{
 assert.deepEqual(extractShipment('The shipment might be five hours late',seed().contacts).fields,{note:'The shipment might be five hours late'});
 assert.deepEqual(extractShipment('Additional description: Maybe delayed. Note: Call the coordinator.',seed().contacts).fields,{note:'Maybe delayed\nCall the coordinator'});
 assert.equal(extractShipment('Additional description: '+ 'x'.repeat(1001),seed().contacts).fields.note,undefined);
 assert.equal(extractShipment('Destination Houston.',seed().contacts).fields.note,undefined);
});
test('screenshot dictation identifies timezone and explains unresolved dates and compact time',()=>{
 const r=extractShipment('Windows started keypad 7th November 344 p.m. and window and it would be 8th November for 10:00 a.m. Windows time zone would be America Chicago practice time',seed().contacts);
 assert.equal(r.fields.windowTz,'America/Chicago');assert.equal(r.fields.windowStart,undefined);assert.equal(r.fields.windowEnd,undefined);
 assert.ok(r.warnings.some(w=>w.includes('344 PM')));assert.ok(r.warnings.some(w=>w.includes('window start')&&w.includes('year')));assert.ok(r.warnings.some(w=>w.includes('window end')&&w.includes('year')));
});
test('dictation accepts explicit day-first dates and different overnight window dates',()=>{
 const r=extractShipment('Window start would be 7th November 2026 at 3:44 p.m. and window end would be 8th November 2026 for 10:00 a.m. Window time zone would be America Chicago.',seed().contacts);
 assert.deepEqual(r.warnings,[]);assert.equal(r.fields.windowStart,'2026-11-07T15:44');assert.equal(r.fields.windowEnd,'2026-11-08T10:00');assert.equal(r.fields.windowTz,'America/Chicago');
 const invalid=extractShipment('Window start 31 February 2026 at 3 PM. Timezone same as yours.',seed().contacts);assert.equal(invalid.fields.windowStart,undefined);assert.equal(invalid.fields.windowTz,undefined);
});
test('voice-filled shipment requires review and its fields and source persist through SQL',async()=>{
 const fields={...extractShipment(description,seed().contacts).fields,scenarioId:'on_time',entryMethod:'browser_voice',voiceTranscript:description};
 assert.throws(()=>transition(seed(),{type:'create',requestId:'entry',fields},localActor),/Review all/);
 const {store,db}=await localStore();try{await store.dispatch({type:'create',requestId:'entry',fields:{...fields,voiceReviewed:'on'}},localActor);const s=await store.read();assert.equal(s.shipments.at(-1)?.reference,'RG-1050');assert.equal(s.audit.at(-1)?.action,'shipment_voice_entry_reviewed');assert.equal((s.audit.at(-1)?.details as any).transcript,description);}finally{await db.close();}
});
test('reviewed spoken delay description persists as a sourced shipment note',async()=>{
 const spoken=description+' Additional description: shipment could be 30 minutes delayed.';
 const fields={...extractShipment(spoken,seed().contacts).fields,scenarioId:'on_time',entryMethod:'browser_voice',voiceTranscript:spoken,voiceReviewed:'on'};
 const {store,db}=await localStore();try{await store.dispatch({type:'create',requestId:'delay-note',fields},localActor);const s=await store.read();const sh=s.shipments.at(-1)!;const note=s.annotations.find(n=>n.shipmentId===sh.id)!;assert.equal(sh.destination,'Austin, Texas');assert.equal(note.text,'shipment could be 30 minutes delayed');assert.equal(note.actorId,localActor.id);assert.equal(note.at,s.clock);assert.equal((s.audit.at(-1)?.details as any).transcript,spoken);assert.equal(s.reports.length,0);}finally{await db.close();}
});
test('simulated handoff replies persist with the delay, without confirming an ETA',async()=>{
 const {store,db}=await localStore();try{await store.dispatch(voiceAction,localActor);const s=await store.read();assert.equal(s.reports[0].instant,null);assert.equal(s.escalations[0].reasons[0].reason,'delay_reported');const details=s.audit.at(-1)!.details as any;assert.equal(details.handoffSession.mode,'simulated_only');assert.equal(details.handoffSession.messages[0].text,'I can help review the delay.');assert.equal(details.handoffSession.status,'ended');}finally{await db.close();}
});
test('invalid handoff roles, unaccepted handoffs and pre-join messages are rejected',()=>{
 for(const fields of [{handoffChoice:'declined'},{handoffSession:{status:'waiting',messages:[{role:'coordinator',text:'Hello'}]}},{handoffSession:{status:'joined',messages:[{role:'system',text:'Hello'}]}}])assert.throws(()=>transition(seed(),{...voiceAction,...fields},localActor),/handoff/i);
});
test('authentication rejects absent, invalid and unassigned accounts',async()=>{
 await assert.rejects(authorize(undefined,async()=>null,async()=>null),/Sign in/);
 await assert.rejects(authorize('invalid',async()=>null,async()=>'coordinator'),/Session expired/);
 await assert.rejects(authorize('valid',async()=>({id:'outsider'}),async()=>null),/waiting for workspace access/);
});
test('authorization uses a fresh membership lookup, never user-editable profile claims',async()=>{
 let role:unknown='viewer';const getUser=async()=>({id:'viewer',email:'viewer@example.test',user_metadata:{role:'coordinator'}});
 assert.equal((await authorize('valid',getUser,async()=>role)).role,'viewer');role=null;await assert.rejects(authorize('valid',getUser,async()=>role),/workspace access/);
});
test('shared team data is readable but viewer writes remain denied',async()=>{
 const {store,db}=await localStore();try{await store.dispatch(voiceAction,{...localActor,id:'member-one'});const s=await store.read();assert.equal(s.escalations.length,1);assert.equal(s.audit.at(-1)?.actorId,'member-one');await assert.rejects(store.dispatch({type:'annotate',requestId:'viewer-note',shipmentId:'shipment-1',text:'no'},{id:'member-two',name:'Viewer',role:'viewer'}),/Read-only/);assert.equal((await store.read()).annotations.length,0);}finally{await db.close();}
});
test('recordings require consent, ownership and a reviewed voice conversation',()=>{
 const state=transition(seed(),voiceAction,localActor),id=state.attempts[0].id;
 assert.equal(recordingPermission(state,id,localActor,'yes').id,id);
 assert.throws(()=>recordingPermission(state,id,localActor,'no'),/consent/);
 assert.throws(()=>recordingPermission(state,id,{...localActor,id:'someone-else'},'yes'),/your own/);
 assert.throws(()=>recordingPermission(state,id,{...localActor,role:'viewer'},'yes'),/Only coordinators/);
});
test('audio validates type, signature and limits and metadata has seven-day expiry',()=>{
 validateAudio(Buffer.from([0x1a,0x45,0xdf,0xa3,0]),'audio/webm');assert.throws(()=>validateAudio(Buffer.from('<script>'),'audio/webm'),/not a supported/);
 assert.throws(()=>validateAudio(Buffer.alloc(10_000_001),'audio/webm'),/under 10 MB/);
 const record=metadata({id:'a',shipmentId:'s'},'audio/webm','microphone_only',1000);assert.equal(Date.parse(record.expiresAt)-Date.parse(record.createdAt),RETENTION_MS);
});
test('recording metadata persists, expired playback is denied and cleanup removes bytes',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'regenesys-audio-'));const {store,db}=await localStore();
 try{const state=await store.dispatch(voiceAction,localActor),record=metadata(state.attempts[0],'audio/webm','microphone_only',1000),storage=await localAudio(directory);await storage.put(record.id,Buffer.from([0x1a,0x45,0xdf,0xa3,0]),record.mime);await store.dispatch({type:'attach_audio',requestId:'recording',recording:record},localActor);const persisted=await store.read();assert.equal(findPlayable(persisted,record.id,2000).id,record.id);assert.throws(()=>findPlayable(persisted,record.id,1000+RETENTION_MS),/expired/);assert.equal(await purgeAudio(storage,persisted,1000+RETENTION_MS),1);await assert.rejects(storage.get(record.id));assert.equal(persisted.audit.at(-1)?.action,'conversation_audio_saved');}finally{await db.close();await rm(directory,{recursive:true,force:true});}
});

test('might-get delay screenshot fills clear route fields and retains the full uncertain note',()=>{
 const r=extractShipment('shipment reference would be RG 1054 and origin is Alaska destination is Houston and be might get 30 minutes late',seed().contacts);
 assert.deepEqual(r.warnings,[]);assert.deepEqual(r.fields,{note:'be might get 30 minutes late',reference:'RG-1054',origin:'Alaska',destination:'Houston'});
 for(const note of ['might get 30 minutes late','might not get 30 minutes late','could arrive thirty minutes late','we might get 30 minutes late']){
  const parsed=extractShipment('Reference RG 1054 origin Alaska destination Houston and '+note,seed().contacts);
  assert.equal(parsed.fields.destination,'Houston');assert.equal(parsed.fields.note,note);assert.deepEqual(parsed.warnings,[]);
 }
});
test('uncertainty affects only its labelled field while a leading qualifier remains global',()=>{
 const r=extractShipment('Reference RG 1054. Origin maybe Alaska. Destination Houston.',seed().contacts);
 assert.equal(r.fields.reference,'RG-1054');assert.equal(r.fields.origin,undefined);assert.equal(r.fields.destination,'Houston');assert.deepEqual(r.warnings,['Origin unchanged: this field was uncertain. Confirm it manually.']);
 assert.deepEqual(extractShipment('Maybe reference RG 1054 origin Alaska destination Houston',seed().contacts).fields,{});
});


test('on-time dictation keeps route prepositions and status out of place names',()=>{
 const cases=[
  'shipment shipment reference RG 1055 origin from Alaska destination to Minnesota and we would be on time',
  'Shipment reference R G one zero five five, origin from Alaska, destination to Minnesota. And we would be on time.'
 ];
 for(const text of cases){const r=extractShipment(text,seed().contacts);assert.deepEqual(r.warnings,[]);assert.deepEqual(r.fields,{reference:'RG-1055',origin:'Alaska',destination:'Minnesota',note:'we would be on time'});}
 for(const status of ['we might be on time','we will not be on time','the shipment is on time','we are not running on time']){
  const r=extractShipment('Origin from Alaska destination to Minnesota and '+status,seed().contacts);
  assert.equal(r.fields.origin,'Alaska');assert.equal(r.fields.destination,'Minnesota');assert.equal(r.fields.note,status);assert.equal(r.fields.scenarioId,undefined);assert.equal(r.fields.windowStart,undefined);
 }
 assert.equal(extractShipment('Origin Frome. Destination Toronto.',seed().contacts).fields.origin,'Frome');
 assert.equal(extractShipment('Origin Frome. Destination Toronto.',seed().contacts).fields.destination,'Toronto');
 assert.equal(extractShipment('Origin from maybe Alaska. Destination to Minnesota.',seed().contacts).fields.origin,undefined);
});
