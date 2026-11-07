import {Temporal} from '@js-temporal/polyfill';
import {normalizeSpeech,uncertainSpeech} from './voice-language';

export type EntryFields={reference:string;contactId:string;origin:string;destination:string;windowStart:string;windowEnd:string;windowTz:string;scenarioId:string;note:string;reason:string};
export function extractShipment(text:string,contacts:{id:string;name:string}[]):{fields:Partial<EntryFields>;warnings:string[]}{
 const fields:Partial<EntryFields>={},warnings:string[]=[];
 if(uncertainSpeech(text))return {fields,warnings:['The description contains uncertain details. Enter or confirm the fields manually.']};
 const normalized=normalizeSpeech(text)
  .replace(/\bwindows?\s+(?:start|started|starts)\b/gi,'window start')
  .replace(/\bwindows?\s+(?:end|ended|ends)\b/gi,'window end')
  .replace(/\bwindow and(?=\s+it would be)/gi,'window end')
  .replace(/\bwindows?\s+time\s*zone\b/gi,'timezone')
  .replace(/\bp\.?m\.?/gi,'PM').replace(/\ba\.?m\.?/gi,'AM');
 const labels='shipment reference|reference|carrier|origin|destination|delivery date|window start|window end|time zone|timezone|practice scenario|practice time|note';
 const matches=[...normalized.matchAll(new RegExp('\\b('+labels+')\\s*(?:is\\b|:)?\\s*([\\s\\S]*?)(?=\\b(?:'+labels+')\\b|$)','gi'))];
 const values:Record<string,string>={},duplicates=new Set<string>();
 for(const match of matches){const key=match[1].toLowerCase().replace('shipment reference','reference').replace('time zone','timezone');if(key in values)duplicates.add(key);values[key]=match[2].trim().replace(/^(?:(?:it )?(?:would be|will be|is)|on)\s+/i,'').replace(/(?:[.;,]+|\s+and)\s*$/,'').trim();}
 for(const key of duplicates){delete values[key];warnings.push(`More than one ${key} was heard. Choose the correct value manually.`);}
 for(const key of ['reference','origin','destination','note'] as const)if(values[key])fields[key]=key==='reference'?values[key].replace(/\bR\s*G\s*[- ]?\s*(\d+)\b/i,'RG-$1'):values[key];
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
 if(!matches.length)warnings.push('Use the field names in the example, or enter the form manually.');
 return {fields,warnings};
}
