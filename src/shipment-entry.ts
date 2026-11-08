import {Temporal} from '@js-temporal/polyfill';
import {normalizeSpeech,uncertainSpeech} from './voice-language';

export type EntryFields={reference:string;contactId:string;origin:string;destination:string;windowStart:string;windowEnd:string;windowTz:string;scenarioId:string;note:string;reason:string};
// A bounded clause boundary, not a general location or intent model. Preserve
// uncertainty/negation verbatim in notes; never turn a duration into an ETA.
const delayClause=/\b(?:(?:the\s+)?(?:shipment|delivery|truck|driver|we|it)\s+(?=[^.;\n]{0,100}\b(?:delay(?:ed)?|late|broke down|breakdown)\b)|(?:be\s+)?(?:could|may|might|will|would)\s+(?:not\s+)?(?:be|get|arrive|run)\s+(?=[^.;\n]{0,60}\b(?:delayed|late)\b)|(?:\d+|one|two|three|four|five|six|ten|fifteen|thirty)\s+(?:minutes?|hours?|days?)\s+(?:late|delayed)\b)/i;
export function extractShipment(text:string,contacts:{id:string;name:string}[]):{fields:Partial<EntryFields>;warnings:string[]}{
 const fields:Partial<EntryFields>={},warnings:string[]=[];
 const normalized=text
  .replace(/\bwindows?\s+(?:start|started|starts)\b/gi,'window start')
  .replace(/\bwindows?\s+(?:end|ended|ends)\b/gi,'window end')
  .replace(/\bwindow and(?=\s+it would be)/gi,'window end')
  .replace(/\bwindows?\s+time\s*zone\b/gi,'timezone');
 const labels='shipment references?|references?|carrier|origin|destination|delivery date|window start|window end|time zone|timezone|practice scenario|practice time|additional description|shipment note|notes?';
 const matches=[...normalized.matchAll(new RegExp('\\b('+labels+')\\b\\s*(?:is\\b|:)?\\s*([\\s\\S]*?)(?=\\b(?:'+labels+')\\b|$)','gi'))];
 const values:Record<string,string>={},duplicates=new Set<string>();
 for(const match of matches){const key=match[1].toLowerCase().replace(/^(?:shipment )?references?$/,'reference').replace('time zone','timezone').replace(/^(?:additional description|shipment note|notes)$/,'note');const value=match[2].trim().replace(/^(?:(?:it )?(?:would be|will be|is)|on)\s+/i,'').replace(/(?:[.;,]+|\s+and)\s*$/,'').trim();if(key==='note'&&values.note){values.note+='\n'+value;continue;}if(key in values)duplicates.add(key);values[key]=value;}
 for(const key of duplicates){delete values[key];warnings.push(`More than one ${key} was heard. Choose the correct value manually.`);}
 const notes:string[]=[];
 let prefix=normalized.slice(0,matches[0]?.index??normalized.length);
 function separateDelay(value:string){const clause=value.match(delayClause);if(!clause)return value;notes.push(value.slice(clause.index).trim().replace(/[.;,]+$/,''));return value.slice(0,clause.index).replace(/(?:[.;,]+|\s+and)\s*$/,'').trim();}
 prefix=separateDelay(prefix);
 for(const key of ['origin','destination'])if(values[key])values[key]=separateDelay(values[key]);
 // Reject obvious non-location fragments without guessing what the recognizer
 // meant. This is deliberately not a city dictionary or geographic validation.
 for(const key of ['origin','destination'])if(values[key]&&/^(?:used in|use in|unknown|unclear|not sure|same as (?:before|above))$/i.test(values[key])){
  warnings.push(`${key[0].toUpperCase()+key.slice(1)} unchanged: "${values[key]}" was not a clear place name. Say or type the location before saving.`);delete values[key];
 }
 if(values.note)notes.push(values.note);
 if(notes.length){const note=[...new Set(notes)].join('\n');if(note.length<=1000)fields.note=note;else warnings.push('The additional description is too long. Shorten it to 1,000 characters before applying it.');}
 delete values.note;
 if(uncertainSpeech(prefix))return {fields,warnings:[...warnings,'The description contains uncertain field details. Enter or confirm those fields manually.']};
 // Uncertainty in one labelled field must not block unrelated clear fields.
 for(const key of Object.keys(values))if(uncertainSpeech(values[key])){
  delete values[key];warnings.push(`${key[0].toUpperCase()+key.slice(1)} unchanged: this field was uncertain. Confirm it manually.`);
 }
 for(const key of Object.keys(values))values[key]=normalizeSpeech(values[key]).replace(/\bp\.?m\.?/gi,'PM').replace(/\ba\.?m\.?/gi,'AM');
 for(const key of ['reference','origin','destination'] as const)if(values[key])fields[key]=key==='reference'?values[key].replace(/\bR\s*G\s*[- ]?\s*(\d+)\b/i,'RG-$1'):values[key];
 if(values.carrier){const found=contacts.filter(c=>c.name.toLowerCase()===values.carrier.toLowerCase());if(found.length===1)fields.contactId=found[0].id;else warnings.push('Carrier was not an exact match. Choose the carrier from the list.');}
 if(values.timezone){const tz=values.timezone.toLowerCase();const found=/^(?:central time|ct|america[ /]chicago)$/.test(tz)?'America/Chicago':/^(?:eastern time|et|america[ /]new[ _]york)$/.test(tz)?'America/New_York':/^(?:india standard time|asia[ /]kolkata)$/.test(tz)?'Asia/Kolkata':undefined;if(found)fields.windowTz=found;else warnings.push('Timezone unchanged: choose a timezone or say America Chicago, Eastern time, or India Standard Time.');}
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const monthPattern=months.join('|');
 function readDate(raw:string):string|undefined{
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return Temporal.PlainDate.from(raw).toString();
  const monthFirst=raw.match(new RegExp('^('+monthPattern+')\\s+(\\d{1,2}),?\\s+(\\d{4})$','i'));
  const dayFirst=raw.match(new RegExp('^(\\d{1,2})\\s+('+monthPattern+'),?\\s+(\\d{4})$','i'));
  const m=monthFirst||dayFirst;if(!m)return undefined;
  return Temporal.PlainDate.from({year:+m[3],month:months.indexOf(m[monthFirst?1:2].toLowerCase())+1,day:+m[monthFirst?2:1]},{overflow:'reject'}).toString();
 }
 let date:string|undefined;
 if(values['delivery date']){try{date=readDate(values['delivery date']);if(!date)warnings.push('Delivery date needs an explicit year, for example 7 November 2026.');}catch{warnings.push('Delivery date is invalid. Check the day, month and year.');}}
 for(const [label,key] of [['window start','windowStart'],['window end','windowEnd']] as const){
  const raw=values[label];if(!raw)continue;
  try{
   if(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(raw)){fields[key]=Temporal.PlainDateTime.from(raw.replace(' ','T')).toString().slice(0,16);continue;}
   const compact=raw.match(/\b(\d{3,4})\s*(AM|PM)\b/i);
   if(compact)warnings.push(`${label}: "${compact[0]}" is unclear. Edit the time with a colon, for example 3:44 PM, before applying it.`);
   const time=raw.match(/(?:^|\s)(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)$/i);
   let fieldDate=date;
   if(time){const dateText=raw.slice(0,time.index).trim().replace(/\s+(?:at|for)$/i,'').trim();if(dateText)fieldDate=readDate(dateText);}
   if(!fieldDate)warnings.push(`${label} unchanged: give the full date with a year, for example 7 November 2026.`);
   if(!time||+time[1]<1||+time[1]>12){if(!compact)warnings.push(`${label} unchanged: give a clear time with AM or PM.`);continue;}
   if(!fieldDate)continue;
   fields[key]=`${fieldDate}T${String(+time[1]%12+(time[3].toLowerCase()==='pm'?12:0)).padStart(2,'0')}:${time[2]||'00'}`;
  }catch{warnings.push(`${label} unchanged: check the date and time. Use a full year and AM or PM.`);}
 }
 if(!matches.length&&!notes.length)warnings.push('Use the field names in the example, or enter the form manually.');
 return {fields,warnings};
}
