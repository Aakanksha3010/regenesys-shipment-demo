import {Temporal} from '@js-temporal/polyfill';
import {hasDelayEvidence, classifyVoiceIntent,normalizeSpeech,spokenEtaDetails} from './voice-language';
import {interpretVoice,type Shipment} from './domain';
import type {VoicePrompt} from './voice-prompts';

export function coordinatorContext(transcript:string,callerNotes:string[],shipment:Shipment,clock:string){
 const combined=transcript+'\n'+callerNotes.join('\n'),normalized=normalizeSpeech(combined);
 const known=spokenEtaDetails(combined);
 const dates=[...new Set(normalized.match(/\b(?:today|tomorrow)\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?\b/gi)||[])];
 const candidate=interpretVoice(transcript,callerNotes.join('\n')||undefined,shipment,clock);
 const texas=/\btexas\b/i.test(combined),needsZone=!!known.time&&!!known.date&&!known.zone;
 let conflictingDate=candidate.reasons.includes('range_or_conflict')&&dates.length>1;
 const relative=dates.find(d=>/^(?:today|tomorrow)$/i.test(d)),calendar=dates.find(d=>! /^(?:today|tomorrow)$/i.test(d));
 if(relative&&calendar){
  try{
   const expected=Temporal.Instant.from(clock).toZonedDateTimeISO(candidate.tz||shipment.windowTz).toPlainDate().add({days:relative.toLowerCase()==='tomorrow'?1:0});
   const parts=calendar.match(/^(\w+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
   const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
   const explicit=parts?Temporal.PlainDate.from({year:parts[3]?Number(parts[3]):expected.year,month:months.indexOf(parts[1].toLowerCase())+1,day:Number(parts[2])},{overflow:'reject'}):Temporal.PlainDate.from(calendar);
   conflictingDate=!expected.equals(explicit);
  }catch{conflictingDate=true;}
 }
 const prompt:VoicePrompt=needsZone?(texas?'coordinator_texas':'coordinator_timezone'):conflictingDate?'coordinator_date':'coordinator_intro';
 return {dates,time:known.time,zone:known.zone,texas,needsZone,conflictingDate,prompt,complete:!!candidate.instant};
}

// Scripted intake only. Replies never change an ETA or resolve an issue.
export function coordinatorReply(text:string,previousCallerMessages:string[],context?:ReturnType<typeof coordinatorContext>):{prompt:VoicePrompt;ended:boolean}{
 const value=text.trim();
 if(/^(?:that's all|that is all|nothing else|no(?: thanks| thank you)?|thank you|thanks|bye|goodbye|done|stop|end conversation)[.!\s]*$/i.test(value)||previousCallerMessages.length>=8)return {prompt:'coordinator_end',ended:true};
 if(classifyVoiceIntent(value).humanRequested||/\b(?:approve|reschedule|negotiate|change (?:the |my |our )?delivery|call (?:the |my |our )?(?:warehouse|receiver|site))\b/i.test(value))return {prompt:'coordinator_limit',ended:false};
 if(hasDelayEvidence(value)&&!previousCallerMessages.some(hasDelayEvidence))return {prompt:'coordinator_delay',ended:false};
 if(context?.needsZone)return {prompt:context.prompt,ended:false};
 if(context?.conflictingDate)return {prompt:'coordinator_date',ended:false};
 if(context?.complete)return {prompt:'coordinator_details',ended:false};
 if(value.length<3||/^(?:huh|what|hello|hi|um|uh)[?!.\s]*$/i.test(value))return {prompt:'coordinator_unclear',ended:false};
 return {prompt:'coordinator_note',ended:false};
}
