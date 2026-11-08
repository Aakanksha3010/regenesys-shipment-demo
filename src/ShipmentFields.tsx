import {useState} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import type {Shipment,Contact,Scenario} from './domain';
import {Dictation} from './Dictation';
import {extractShipment,type EntryFields} from './shipment-entry';

export function ShipmentFields({shipment,contacts,scenarios,busy}:{shipment?:Shipment;contacts:Contact[];scenarios:Scenario[];busy:boolean}){
 const local=(iso:string)=>Temporal.Instant.from(iso).toZonedDateTimeISO(shipment!.windowTz).toPlainDateTime().toString().slice(0,16);
 const [fields,setFields]=useState<EntryFields>({reference:shipment?.reference||'',contactId:shipment?.contactId||contacts[0]?.id||'',origin:shipment?.origin||'',destination:shipment?.destination||'',windowStart:shipment?local(shipment.windowStart):'2026-11-11T13:00',windowEnd:shipment?local(shipment.windowEnd):'2026-11-11T17:00',windowTz:shipment?.windowTz||'America/Chicago',scenarioId:shipment?.scenarioId||scenarios[0]?.id||'',note:'',reason:''});
 const [transcript,setTranscript]=useState(''),[source,setSource]=useState(''),[method,setMethod]=useState('typed_dictation'),[sourceMethod,setSourceMethod]=useState(''),[reviewed,setReviewed]=useState(false),[warnings,setWarnings]=useState<string[]>([]),[updated,setUpdated]=useState<string[]>([]);
 function change(key:keyof EntryFields,value:string){setFields(f=>({...f,[key]:value}));setReviewed(false);}
 function apply(){
  const result=extractShipment(transcript,contacts);
  const combined=source&&source!==transcript?source+'\nNext dictation: '+transcript:transcript;
  if(combined.length>4000){setWarnings(['The combined dictation is too long. Finish this draft by editing the fields manually.']);return;}
  if(result.fields.note&&fields.note){
   const note=fields.note.includes(result.fields.note)?fields.note:fields.note+'\n'+result.fields.note;
   if(note.length>1000){delete result.fields.note;result.warnings.push('Your existing description was kept. Adding the spoken note would exceed 1,000 characters; shorten it manually.');}else result.fields.note=note;
  }
  setFields(f=>({...f,...result.fields}));setWarnings(result.warnings);setUpdated(Object.keys(result.fields));setSource(combined);setSourceMethod(sourceMethod==='typed_dictation'?'typed_dictation':method);setReviewed(false);
 }
 const names:Record<string,string>={reference:'shipment reference',contactId:'carrier',origin:'origin',destination:'destination',windowStart:'window start',windowEnd:'window end',windowTz:'timezone',note:'additional description'};
 const missing=['reference','contactId','origin','destination','windowStart','windowEnd','windowTz'].filter(key=>!fields[key as keyof EntryFields]);

 const input=(label:string,key:keyof EntryFields,type='text',maxLength=150)=><label>{label}<input name={key} type={type} required maxLength={maxLength} value={fields[key]} disabled={busy} onChange={e=>change(key,e.target.value)}/></label>;
 return <>
  <p>Type the details, or describe the shipment and review the filled fields. Use fictional details in this workspace.</p>
  <details className="shipment-dictation"><summary>Fill with your voice</summary><p>Say the field names, then their values. You can update just one field at a time. Dates need a year and times need AM or PM. For an overnight window, give a separate date for each end. Spoken delay details go into Additional description for you to review.</p><blockquote>Reference RG 1050. Carrier Northline Freight. Origin Dallas, Texas. Destination Austin, Texas. Delivery date November eleventh, 2026. Window start one PM. Window end five PM. Timezone Central time. Additional description: shipment could be 30 minutes delayed.</blockquote>
   <Dictation disabled={busy} onText={text=>{setTranscript(text);setMethod('browser_voice');setReviewed(false);}}/>
   <label>Shipment dictation<textarea value={transcript} maxLength={4000} disabled={busy} onChange={e=>{setTranscript(e.target.value);setMethod('typed_dictation');setReviewed(false);}} placeholder="Your words appear here. You can edit them before filling the form."/></label>
   <button type="button" disabled={busy||!transcript.trim()} onClick={apply}>Fill fields from description</button><p className="hint">Only clearly understood fields are updated. Your other entries stay as they are. Nothing is saved yet.</p>
  </details>
  {source&&<p role="status">{updated.length?'Updated: '+updated.map(k=>names[k]||k).join(', ')+'. Other fields were kept.':'No fields were changed. Edit the description or complete the form below.'}{missing.length>0&&' Still needed: '+missing.map(k=>names[k]).join(', ')+'.'}</p>}
  {warnings.length>0&&<div className="voice-warning" role="status">{warnings.map(w=><p key={w}>{w}</p>)}</div>}
  <div className="form-grid">
   {input('Shipment reference','reference','text',60)}
   <label>Carrier contact<select required name="contactId" value={fields.contactId} disabled={busy} onChange={e=>change('contactId',e.target.value)}><option value="">Choose a carrier</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   {input('Origin','origin')}{input('Destination','destination')}{input('Window start','windowStart','datetime-local')}{input('Window end','windowEnd','datetime-local')}
   <label>Window timezone<select required name="windowTz" value={fields.windowTz} disabled={busy} onChange={e=>change('windowTz',e.target.value)}><option value="">Choose a timezone</option><option>America/Chicago</option><option>America/New_York</option><option>Asia/Kolkata</option></select></label>
   <label>Practice scenario<select name="scenarioId" value={fields.scenarioId} disabled={busy} onChange={e=>change('scenarioId',e.target.value)}>{scenarios.map(sc=><option key={sc.id} value={sc.id}>{sc.label}</option>)}</select></label>
  </div>
  <label>Additional description / shipment note (optional)<textarea aria-label="Additional description / shipment note (optional)" name="note" value={fields.note} disabled={busy} maxLength={1000} onChange={e=>change('note',e.target.value)}/></label>
  {shipment&&<label>Why are you changing these details?<textarea name="reason" required value={fields.reason} disabled={busy} maxLength={1000} onChange={e=>change('reason',e.target.value)}/></label>}
  {source&&<><input type="hidden" name="entryMethod" value={sourceMethod}/><input type="hidden" name="voiceTranscript" value={source}/><details><summary>Applied description</summary><p>{source}</p></details><label className="voice-consent"><input type="checkbox" name="voiceReviewed" required checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/><span>I checked every filled field against the description, including the carrier, dates and timezone.</span></label></>}
 </>;
}
