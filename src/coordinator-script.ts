import {hasDelayEvidence, classifyVoiceIntent} from './voice-language';
import type {VoicePrompt} from './voice-prompts';

// Scripted intake only. Replies never change an ETA or resolve an issue.
export function coordinatorReply(text:string,previousCallerMessages:string[]):{prompt:VoicePrompt;ended:boolean}{
 const value=text.trim();
 if(/^(?:that's all|that is all|nothing else|no(?: thanks| thank you)?|thank you|thanks|bye|goodbye|done|stop|end conversation)[.!\s]*$/i.test(value)||previousCallerMessages.length>=8)return {prompt:'coordinator_end',ended:true};
 if(classifyVoiceIntent(value).humanRequested||/\b(?:approve|reschedule|negotiate|change (?:the |my |our )?delivery|call (?:the |my |our )?(?:warehouse|receiver|site))\b/i.test(value))return {prompt:'coordinator_limit',ended:false};
 if(hasDelayEvidence(value)&&!previousCallerMessages.some(hasDelayEvidence))return {prompt:'coordinator_delay',ended:false};
 if(value.length<3||/^(?:huh|what|hello|hi|um|uh)[?!.\s]*$/i.test(value))return {prompt:'coordinator_unclear',ended:false};
 return {prompt:'coordinator_note',ended:false};
}
