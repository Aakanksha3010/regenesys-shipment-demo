import {Temporal} from '@js-temporal/polyfill';
import {normalizeSpeech,uncertainSpeech} from './voice-language';

export type EntryFields={reference:string;contactId:string;origin:string;destination:string;windowStart:string;windowEnd:string;windowTz:string;scenarioId:string;note:string;reason:string};
export function extractShipment(text:string,contacts:{id:string;name:string}[]):{fields:Partial<EntryFields>;warnings:string[]}{
 const fields:Partial<EntryFields>={},warnings:string[]=[];
 if(uncertainSpeech(text))return {fields,warnings:['The description contains uncertain details. Enter or confirm the fields manually.']};
 const normalized=normalizeSpeech(text).replace(/\bp\.?m\.?/gi,'PM').replace(/\ba\.?m\.?/gi,'AM');
 const labels='shipment reference|reference|carrier|origin|destination|delivery date|window start|window end|time zone|timezone|note';
 const matches=[...normalized.matchAll(new RegExp('\\b('+labels+')\\s*(?:is\\b|:)?\\s*([\\s\\S]*?)(?=\\b(?:'+labels+')\\b|$)','gi'))];
 const values:Record<string,string>={},duplicates=new Set<string>();
 for(const match of matches){const key=match[1].toLowerCase().replace('shipment reference','reference').replace('time zone','timezone');if(key in values)duplicates.add(key);values[key]=match[2].trim().replace(/[.;,]+$/,'').trim();}
 for(const key of duplicates){delete values[key];warnings.push(`More than one ${key} was heard. Choose the correct value manually.`);}
 for(const key of ['reference','origin','destination','note'] as const)if(values[key])fields[key]=key==='reference'?values[key].replace(/\bR\s*G\s*[- ]?\s*(\d+)\b/i,'RG-$1'):values[key];
 if(values.carrier){const found=contacts.filter(c=>c.name.toLowerCase()===values.carrier.toLowerCase());if(found.length===1)fields.contactId=found[0].id;else warnings.push('Carrier was not an exact match. Choose the carrier from the list.');}
 if(values.timezone){const tz=values.timezone.toLowerCase();fields.windowTz=/^(?:central time|ct|america\/chicago)$/.test(tz)?'America/Chicago':/^(?:eastern time|et|america\/new_york)$/.test(tz)?'America/New_York':/^(?:india standard time|asia\/kolkata)$/.test(tz)?'Asia/Kolkata':'';if(!fields.windowTz)warnings.push('Timezone was unclear. Choose it explicitly.');}
 let date='';
 if(values['delivery date']){
  try{
   const raw=values['delivery date'],iso=raw.match(/^\d{4}-\d{2}-\d{2}$/),parts=raw.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})$/i);
   const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
   if(iso)date=Temporal.PlainDate.from(raw).toString();else if(parts)date=Temporal.PlainDate.from({year:Number(parts[3]),month:months.indexOf(parts[1].toLowerCase())+1,day:Number(parts[2])},{overflow:'reject'}).toString();else warnings.push('Give a delivery date with its year; relative dates are not filled automatically.');
  }catch{warnings.push('The delivery date was invalid. Enter it manually.');}
 }
 for(const [label,key] of [['window start','windowStart'],['window end','windowEnd']] as const){
  const raw=values[label];if(!raw)continue;
  try{
   if(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(raw)){fields[key]=Temporal.PlainDateTime.from(raw.replace(' ','T')).toString().slice(0,16);continue;}
   const time=raw.match(/^(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)$/i);
   if(!date||!time||+time[1]<1||+time[1]>12){warnings.push(`Give ${label} with AM or PM and an explicit delivery date.`);continue;}
   fields[key]=`${date}T${String(+time[1]%12+(time[3].toLowerCase()==='pm'?12:0)).padStart(2,'0')}:${time[2]||'00'}`;
  }catch{warnings.push(`The ${label} was invalid. Enter it manually.`);}
 }
 if(!matches.length)warnings.push('Use the field names in the example, or enter the form manually.');
 return {fields,warnings};
}
