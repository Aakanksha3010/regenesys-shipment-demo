import type {VoicePrompt} from './voice-prompts.js';
// Deliberately bounded speech normalization, not general natural-language extraction.
export function normalizeSpeech(text: string): string {
  const numbers: Record<string, number> = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
  const ordinals: Record<string, number> = {first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10,eleventh:11,twelfth:12,thirteenth:13,fourteenth:14,fifteenth:15,sixteenth:16,seventeenth:17,eighteenth:18,nineteenth:19,twentieth:20,'twenty first':21,'twenty second':22,'twenty third':23,'twenty fourth':24,'twenty fifth':25,'twenty sixth':26,'twenty seventh':27,'twenty eighth':28,'twenty ninth':29,thirtieth:30,'thirty first':31};
  return text.replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/gi,'$1')
    .replace(/\b(\d{1,2})\s+(?:of\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi,'$2 $1')
    .replace(new RegExp('\\b('+Object.keys(ordinals).sort((a,b)=>b.length-a.length).join('|')+')\\s+(?:of\\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\\b','gi'),(_all,day,month)=>`${month} ${ordinals[day.toLowerCase()]}`)
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(twenty[- ]\w+|thirty[- ]first|\w+)/gi,(all,month,day)=>ordinals[day.toLowerCase().replace('-',' ')]?`${month} ${ordinals[day.toLowerCase().replace('-',' ')]}`:all)
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+(fifteen|thirty|forty[- ]five))?\s+(a\.?m\.?|p\.?m\.?)\b/gi,(_all,h,m,ap)=>`${numbers[h.toLowerCase()]}${m?':'+(({fifteen:'15',thirty:'30','forty five':'45'} as Record<string,string>)[m.toLowerCase().replace('-',' ')]):''} ${ap}`)
    .replace(/\b(central|eastern|mountain)\s+(standard|daylight)\s+time\b/gi,'$1 time')
    // Explicit demo alias shown beside the voice controls; never infer from device locale.
    .replace(/\bi[ .]*s[ .]*t\b/gi,'India Standard Time');
}

export function spokenEtaDetails(text:string){
 const normalized=normalizeSpeech(text);
 return {
  date:normalized.match(/\b(?:today|tomorrow)\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s+\d{4})?\b/i)?.[0],
  time:normalized.match(/\b(?:[1-9]|1[0-2])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b/i)?.[0],
  zone:normalized.match(/\b(?:central time|ct|eastern time|et|mountain time|mt|india standard time|indian standard time)\b/i)?.[0],
 };
}
export const hasArrivalWindow=(text:string)=>/\bwithin\s+(?:\d+|one|two|three|four|five|six|twelve|twenty[- ]four)\s+(?:hours?|days?|minutes?)\b/i.test(text);

export function voiceClarification(text:string):VoicePrompt {
 if(hasDelayEvidence(text))return 'delay_handoff';
 if(hasUnresolvedTimeReference(text))return 'clarification';
 if(/\bbetween\b|\bactually\b|\bmidnight\b/i.test(text))return 'clarification';
 const {date,time,zone}=spokenEtaDetails(text);
 if(date&&time&&!zone&&(uncertainSpeech(text)||hasArrivalWindow(text)))return 'ask_timezone_uncertain';
 if(date&&time&&!zone&&/\btexas\b/i.test(text))return 'ask_texas_timezone';
 const missing=[!date?'date':'',!time?'time':'',!zone?'timezone':''].filter(Boolean).join('_');
 const prompts:Record<string,VoicePrompt>={date:'ask_date',time:'ask_time',timezone:'ask_timezone',date_time:'ask_date_time',date_timezone:'ask_date_timezone',time_timezone:'ask_time_timezone'};
 return prompts[missing]||'clarification';
}

export function voiceEnding(text: string): 'completed'|'refused'|'wrong_number'|'voicemail'|'no_answer' {
  if(!text.trim()||text.trim()==='[No response heard]')return 'no_answer';
  if(/\bwrong number\b|\bnot (?:your|the) carrier\b/i.test(text))return 'wrong_number';
  if(/\b(?:refuse|won't|will not|cannot|can't)\s+(?:share|provide|give|disclose)\b|\b(?:do not|don't|stop) call(?:ing)?\b/i.test(text))return 'refused';
  if(/\bleave (?:a|your) message\b|\bvoicemail\b/i.test(text))return 'voicemail';
  return 'completed';
}

export const uncertainSpeech = (text:string) => /\bmaybe\b|\bperhaps\b|\bnot (?:sure|certain)\b|\bi think\b|\bi guess\b|\bmight\b|\bprobably\b|\bhopefully\b|\bapproximately\b|\baround\b/i.test(text);

export function hasDelayEvidence(text:string):boolean {
  const duration='(?:\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty)[ -]+(?:hours?|hrs?|minutes?|mins?|days?)';
  const positive=text.replace(new RegExp('\\b(?:not|never)\\s+(?:(?:'+duration+'|running)\\s+)?late\\b|\\b(?:not|never)\\s+delayed\\b|\\b(?:won\'t|will not) be late\\b|\\bno delays?\\b','gi'),'');
  return /\brunning late\b|\bdelay(?:ed)?\b|\bbroke down\b|\bbreakdown\b|\b(?:will be|going to be|arriving|we are|we're|i am|i'm) late\b/i.test(positive)||new RegExp('\\b'+duration+'[ -]+late\\b','i').test(positive);
}

// These refer to a clock or an unresolved baseline, not an absolute arrival.
// Do not add durations to the device clock or to a guessed scheduled ETA.
export const hasUnresolvedTimeReference=(text:string)=>/\bright now\b|\bcurrent time\b|\btoday['’]s time\b|\b(?:late|later)\s+(?:from|than)\s+(?:(?:the|our|original)\s+)*(?:estimate|scheduled|estimate[d]? arrival)\b/i.test(text);

export function classifyVoiceIntent(text:string){
 const ending=voiceEnding(text);
 const frustrated=/\b(?:frustrat(?:ed|ing)|annoy(?:ed|ing)|irritat(?:ed|ing)|angry|fed up|ridiculous)\b|\bwasting my time\b|\balready told you\b|\bnot listening\b|\bstop asking\b/i.test(text)&&!/\bnot (?:frustrated|annoyed|irritated|angry)\b/i.test(text);
 const humanRequested=/\b(?:human|real person|representative|customer support|customer service)\b|\b(?:speak|talk|connect|transfer)\b.{0,35}\b(?:person|agent|coordinator)\b/i.test(text)&&!/\b(?:no|don't|do not|not)\b.{0,15}\b(?:need|want|human|person|support)\b/i.test(text);
 const intent=ending!=='completed'?ending:hasDelayEvidence(text)?'delay_report':humanRequested?'human_request':frustrated?'frustration':/\b(?:\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i.test(text)?'eta_update':'unclear';
 return {intent,frustrated,humanRequested};
}

export function callerReply(result:{reasons:string[];delay:boolean;voiceIntent?:string;frustrated?:boolean}):VoicePrompt{
 if(result.frustrated)return 'empathy_handoff';
 if(result.voiceIntent==='human_request')return 'human_handoff';
 if(result.delay||result.reasons.includes('eta_after_window'))return 'delay_handoff';
 if(result.reasons.some(r=>['ambiguous','incomplete_eta','range_or_conflict'].includes(r)))return 'uncertain_handoff';
 return result.reasons.length?'escalation':'review';
}
