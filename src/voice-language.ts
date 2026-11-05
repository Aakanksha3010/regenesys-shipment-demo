// Deliberately bounded speech normalization, not general natural-language extraction.
export function normalizeSpeech(text: string): string {
  const numbers: Record<string, number> = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
  const ordinals: Record<string, number> = {first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10,eleventh:11,twelfth:12,thirteenth:13,fourteenth:14,fifteenth:15,sixteenth:16,seventeenth:17,eighteenth:18,nineteenth:19,twentieth:20,'twenty first':21,'twenty second':22,'twenty third':23,'twenty fourth':24,'twenty fifth':25,'twenty sixth':26,'twenty seventh':27,'twenty eighth':28,'twenty ninth':29,thirtieth:30,'thirty first':31};
  return text.replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/gi,'$1')
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(twenty[- ]\w+|thirty[- ]first|\w+)/gi,(all,month,day)=>ordinals[day.toLowerCase().replace('-',' ')]?`${month} ${ordinals[day.toLowerCase().replace('-',' ')]}`:all)
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+(fifteen|thirty|forty[- ]five))?\s+(a\.?m\.?|p\.?m\.?)\b/gi,(_all,h,m,ap)=>`${numbers[h.toLowerCase()]}${m?':'+(({fifteen:'15',thirty:'30','forty five':'45'} as Record<string,string>)[m.toLowerCase().replace('-',' ')]):''} ${ap}`)
    .replace(/\b(central|eastern)\s+(standard|daylight)\s+time\b/gi,'$1 time');
}

export function voiceEnding(text: string): 'completed'|'refused'|'wrong_number'|'voicemail'|'no_answer' {
  if(!text.trim()||text.trim()==='[No response heard]')return 'no_answer';
  if(/\bwrong number\b|\bnot (?:your|the) carrier\b/i.test(text))return 'wrong_number';
  if(/\b(?:refuse|won't|will not|cannot|can't)\s+(?:share|provide|give|disclose)\b|\b(?:do not|don't|stop) call(?:ing)?\b/i.test(text))return 'refused';
  if(/\bleave (?:a|your) message\b|\bvoicemail\b/i.test(text))return 'voicemail';
  return 'completed';
}

export const uncertainSpeech = (text:string) => /\bmaybe\b|\bperhaps\b|\bnot sure\b|\bmight\b|\bprobably\b|\bhopefully\b|\bapproximately\b|\baround\b/i.test(text);
