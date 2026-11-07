// Only these generic prompts are sent to the speech provider. No shipment or transcript data.
export const voicePrompts = {
  preview: "Hi, I'm Bella, your Regenesys shipment assistant. This is a voice sample. Start a conversation when you're ready to talk with me.",
  intro: "Hi, this is Regenesys checking your delivery. What date and time do you expect to arrive, and which time zone is that?",
  clarification: "Could you give me the arrival date, time with AM or PM, and time zone? If you're unsure, that's okay. Just let me know.",
  ask_date: "Got the time and time zone. What date will you arrive?",
  ask_time: "Got the date and time zone. What time will you arrive, including AM or PM?",
  ask_timezone: "Got the date and time. Which time zone is that?",
  ask_date_time: "Got the time zone. What date and time will you arrive, including AM or PM?",
  ask_date_timezone: "Got the time. What date will you arrive, and which time zone is that?",
  ask_time_timezone: "Got the date. What time will you arrive, including AM or PM, and which time zone is that?",
  review: "Thanks for the update. That's all I need.",
  escalation: "I don't want to get your arrival details wrong. A human coordinator can help from here.",
  delay_handoff: "I'm sorry you're running late. A human coordinator can help with the delay. Would you like to try the simulated handoff and continue on the coordinator screen?",
  human_handoff: "Of course. Would you like me to help you reach a human coordinator?",
  empathy_handoff: "I'm sorry this has been frustrating. You shouldn't have to keep repeating yourself. Would you like to speak with a human coordinator?",
  hold_demo: "This is a simulated handoff. You'll hear a short hold-music preview. Open the coordinator screen to play that role and join the conversation. A real person won't join by phone.",
  handoff_declined: "Understood. Thanks for the update.",
} as const;
export type VoicePrompt = keyof typeof voicePrompts;
export type VoiceOption = {id:string;name:string;description:string};
export type VoiceOptions = {configured:boolean;voices:VoiceOption[]};
