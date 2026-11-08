import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const conversations:{name:string;evidence:string;turns:{role:string;content:string}[]}[]=[];
test.afterEach(async({page},info)=>{const turns=await page.evaluate(()=>(window as any).__conversationTurns||[]).catch(()=>[]);if(turns.length)conversations.push({name:info.title,evidence:'mocked browser speech APIs; no real audio',turns});});
test.afterAll(async()=>{await mkdir('validation',{recursive:true});await writeFile('validation/conversations-results.json',JSON.stringify(conversations,null,2));});

// These are controlled API doubles, not proof of real microphone/recognition quality.
async function mockSpeech(page:Page,answers:string[],error?:string){
 await page.addInitScript(({answers,error})=>{
  (window as any).__conversationTurns=[];
  class Recognition {
   onresult:any;onend:any;onerror:any;aborted=false;
   start(){setTimeout(()=>{if(this.aborted)return;if(error)this.onerror?.({error});else {const transcript=answers.shift()||'';if(transcript)(window as any).__conversationTurns.push({role:'user',content:transcript});this.onresult?.({results:[{isFinal:true,0:{transcript}}]});}this.onend?.();},30);}
   stop(){this.onend?.();}abort(){this.aborted=true;}
  }
  Object.defineProperty(window,'SpeechRecognition',{value:Recognition,configurable:true});
  let current:any;(window as any).__spokenPrompts=[];
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel:()=>{current=null;},speak:(u:any)=>{(window as any).__spokenPrompts.push(u.text);(window as any).__conversationTurns.push({role:'assistant',content:u.text});current=u;setTimeout(()=>{if(current===u)u.onend?.();},30);}},configurable:true});
 },{answers,error});
}
async function open(page:Page,showDetails=true){await page.goto('/');await page.getByRole('button',{name:'RG-1041',exact:true}).click();await page.getByRole('button',{name:'Talk with Bella',exact:true}).click();const panel=page.getByRole('dialog',{name:'Talk with Bella',exact:true});if(showDetails)await panel.getByText('Conversation details (optional)',{exact:true}).click();return panel;}
test.beforeEach(async({request})=>{const config=await (await request.get('/api/config')).json();expect(config.mode,'Browser tests must use isolated local mode').toBe('local');expect((await request.post('/api/reset',{data:{confirm:'RESET DEMO'}})).ok()).toBeTruthy();});

test('speech conversation asks one clarification and saves only after review',async({page,request})=>{
 await mockSpeech(page,['Tomorrow at three thirty PM','Central time']);const panel=await open(page);
 await panel.getByLabel('Agent audio').selectOption('browser');
 await expect(panel.getByRole('button',{name:'Start conversation'})).toBeDisabled();
 await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByLabel('Clarification answer')).toHaveValue('Central time');
 await expect(panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/})).toBeDisabled();
 expect((await (await request.get('/api/state')).json()).state.attempts).toHaveLength(0);
 await page.screenshot({path:test.info().outputPath('voice-demo.png'),fullPage:true});
 await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/}).click();
 await expect(panel).not.toBeVisible();const state=(await (await request.get('/api/state')).json()).state;
 expect(state.reports[0].instant).toBe('2026-11-11T21:30:00Z');expect(state.attempts[0].inputMethod).toBe('browser_voice');
});
test('spoken breakdown enters human queue without an invented ETA',async({page,request})=>{
 await mockSpeech(page,['Truck broke down, not sure when']);const panel=await open(page);
 await panel.getByLabel('Agent audio').selectOption('browser');
 await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByLabel('Carrier answer')).toHaveValue('Truck broke down, not sure when');
 await expect(panel.getByText('Ready to forward to our human agent team',{exact:true})).toBeVisible();
 await expect(panel.getByRole('checkbox').last()).toBeEnabled();await panel.getByRole('checkbox').last().check();
 await panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;expect(state.reports[0].capture).toBe('uncaptured');expect(state.escalations[0].reasons.map((r:any)=>r.reason)).toContain('delay_reported');
});
test('microphone denial offers a labelled typed fallback and saves nothing automatically',async({page,request})=>{
 await mockSpeech(page,[],'not-allowed');const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByRole('alert')).toContainText('denied');
 expect((await (await request.get('/api/state')).json()).state.attempts).toHaveLength(0);
 await panel.getByLabel('Carrier answer').fill('Wrong number');await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;expect(state.contacts[0].suppressed).toBe(true);expect(state.attempts[0].inputMethod).toBe('typed_demo');
});
test('closing a voice draft discards it without a stuck check',async({page,request})=>{
 const panel=await open(page);await panel.getByLabel('Carrier answer').fill('tomorrow at 3 PM Central time');await panel.getByRole('button',{name:'Close dialog'}).click();
 expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
});
test('voice entry is usable on mobile and transcript edits revoke review',async({page})=>{
 await page.setViewportSize({width:390,height:844});const panel=await open(page);await panel.getByLabel('Carrier answer').fill('tomorrow at 3 PM Central time');await panel.getByRole('checkbox').last().check();await panel.getByLabel('Carrier answer').fill('maybe tomorrow at 3 PM Central time');await expect(panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/})).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('natural voice requires setup and browser fallback is an explicit choice',async({page,request})=>{
 const panel=await open(page);await expect(panel.getByText('ElevenLabs is not connected yet.',{exact:false})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Play voice sample'})).toBeDisabled();
 expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
 await panel.getByLabel('Agent audio').selectOption('browser');await expect(panel.getByRole('button',{name:'Play voice sample'})).toBeEnabled();
});
test('ElevenLabs preview uses selected voice and provider failure never falls back silently',async({page,request})=>{
 await page.route('**/api/voice/options',route=>route.fulfill({json:{configured:true,voices:[{id:'voiceA',name:'Warm voice',description:'Conversational'},{id:'voiceB',name:'Clear voice',description:'Clear and friendly'}]}}));
 let payload:any;await page.route('**/api/voice/speech',route=>{payload=route.request().postDataJSON();return route.fulfill({status:503,json:{error:'ElevenLabs usage unavailable for test'}});});
 const panel=await open(page);await panel.getByLabel('Agent voice').selectOption('voiceB');await panel.getByRole('button',{name:'Play voice sample'}).click();
 await expect(panel.getByRole('alert')).toHaveText('ElevenLabs usage unavailable for test');expect(payload).toEqual({prompt:'preview',voiceId:'voiceB'});
 await expect(panel.getByLabel('Agent audio')).toHaveValue('elevenlabs');expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
});
test('closing while natural audio loads prevents late playback',async({page})=>{
 await page.route('**/api/voice/options',route=>route.fulfill({json:{configured:true,voices:[{id:'voiceA',name:'Warm voice',description:''}]}}));
 let release!:()=>void;const waiting=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/voice/speech',async route=>{await waiting;await route.fulfill({status:503,json:{error:'Delayed result'}}).catch(()=>{});});
 const panel=await open(page);await panel.getByRole('button',{name:'Play voice sample'}).click();await expect(panel.getByText('Playing sample · microphone off')).toBeVisible();await panel.getByRole('button',{name:'Close dialog'}).click();release();await expect(panel).not.toBeVisible();
});
test('voice sample clearly keeps the microphone off and cannot be mistaken for a conversation',async({page,request})=>{
 await mockSpeech(page,['Tomorrow at 3 PM Central time']);const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('button',{name:'Play voice sample'}).click();
 await expect(panel.getByText('Voice sample finished · microphone off',{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Start conversation'})).toBeDisabled();await expect(panel.getByLabel('Carrier answer')).toHaveValue('');
 const turns=await page.evaluate(()=>(window as any).__conversationTurns);expect(turns.filter((t:any)=>t.role==='user')).toHaveLength(0);expect(turns[0].content).toContain('This is a voice sample.');expect(turns[0].content).not.toContain('What date');
 expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
});

test('video regression: retain 3 p.m., ask date and zone only, offer delay handoff',async({page,request})=>{
 await mockSpeech(page,['expect the shipment to arrive at 3:00 p.m.','There is a 30-minute delay','No thanks']);
 const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByText('Understood. Thanks for the update.',{exact:true})).toBeVisible();
 const spoken=await page.evaluate(()=>(window as any).__spokenPrompts);
 expect(spoken[1]).toBe('Got the time. What date will you arrive, and which time zone is that?');
 expect(spoken[2]).toContain('delay');expect(spoken.join(' ')).not.toMatch(/transcript|backend|save|cleanliness|AM or PM/);
 await expect(panel.getByLabel('Carrier answer')).toHaveValue('expect the shipment to arrive at 3:00 p.m.');
 expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
 await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;expect(state.reports[0].instant).toBeNull();expect(state.escalations[0].reasons.map((r:any)=>r.reason)).toContain('delay_reported');
 expect(state.audit.at(-1).details.handoffChoice).toBe('declined');expect(state.audit.at(-1).details.handoffMode).toBe('simulated_only');
});
test('spoken 3 PM IST asks only for date, retains time and zone, and requires coordinator review',async({page,request})=>{
 await mockSpeech(page,['3 PM IST','November eleventh, 2026']);const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByText("Thanks for the update. That's all I need.",{exact:true})).toBeVisible();
 const spoken=await page.evaluate(()=>(window as any).__spokenPrompts);expect(spoken[1]).toBe('Got the time and time zone. What date will you arrive?');
 await expect(panel.getByText('Asia/Kolkata',{exact:false}).last()).toBeVisible();expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
});
test('frustrated caller gets empathy and accepted demo hold never claims a human connected',async({page,request})=>{
 await mockSpeech(page,['I already told you, this is frustrating','Yes please']);const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByText('Simulated hold music…',{exact:true})).toBeVisible();
 const spoken=await page.evaluate(()=>(window as any).__spokenPrompts);expect(spoken[1]).toContain("I'm sorry this has been frustrating");expect(spoken[1]).toContain('simulated handoff');expect(spoken[1]).toContain("a real person won't join");expect(spoken[2]).toMatch(/a real person won't join/i);
 await panel.getByRole('button',{name:'Stop audio'}).click();await expect(panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/})).toBeDisabled();
 expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
});

test('explicit human request offers help without another ETA question',async({page,request})=>{
 await mockSpeech(page,['I want to speak to a human','No thanks']);const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByText('Understood. Thanks for the update.',{exact:true})).toBeVisible();
 const spoken=await page.evaluate(()=>(window as any).__spokenPrompts);expect(spoken[1]).toContain('human coordinator');expect(spoken[1]).toContain('simulated handoff');expect(spoken[1]).toContain("a real person won't join");expect(spoken[1]).not.toMatch(/date|time zone|arrival time/);
 await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;expect(state.escalations[0].reasons.map((r:any)=>r.reason)).toContain('human_requested');expect(state.contacts[0].suppressed).toBe(false);
});

test('real retest regression: five hours late immediately offers a simulated handoff and preserves unconfirmed ETA',async({page,request})=>{
 const answer="we'll be arriving five hours late from today's time";
 await mockSpeech(page,[answer,'No thanks']);const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByText('Understood. Thanks for the update.',{exact:true})).toBeVisible();
 const spoken=await page.evaluate(()=>(window as any).__spokenPrompts);
 expect(spoken).toHaveLength(3);expect(spoken[1]).toMatch(/sorry.*human coordinator.*simulated handoff/i);
 expect(spoken[1]).not.toMatch(/got the date|what time|time zone|connected|AM or PM/i);
 expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
 await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;
 expect(state.reports[0].instant).toBeNull();expect(state.reports[0].capture).toBe('uncaptured');expect(state.reports[0].assessment).toBe('delay');
 expect(state.escalations[0].reasons.map((r:any)=>r.reason)).toContain('delay_reported');expect(state.audit.at(-1).details.handoffChoice).toBe('declined');
});

test('screenshot 5 AM avoids repeated time questions and forwards uncertainty without claiming delay',async({page,request})=>{
 const first='we would be expected to come around 10th of November at 5:00 a.m. and we are expected to arrive within 24 hours and the time zone is same as Texas';
 await mockSpeech(page,[first,'can you write 5:00 a.m.','No thanks']);const panel=await open(page,false);await expect(panel.getByLabel('Carrier answer')).not.toBeVisible();await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();await expect(panel.getByText('Understood. Thanks for the update.',{exact:true})).toBeVisible();
 const spoken=await page.evaluate(()=>(window as any).__spokenPrompts);expect(spoken[1]).toContain('I have the date and time you mentioned');expect(spoken[1]).toContain('which time zone');expect(spoken[1]).not.toMatch(/what time|what date|AM or PM/i);expect(spoken[2]).toContain('human agent team');expect(spoken[2]).toContain('simulated handoff');expect(spoken[2]).not.toMatch(/\b(?:delay|late)\b/);
 await expect(panel.getByText('No delay was reported. The team will help clarify the arrival details.',{exact:true})).toBeVisible();await expect(panel.getByText('Details heard:',{exact:false})).toContainText('5:00');await expect(panel.getByText('Human review required')).toHaveCount(0);await expect(panel.getByLabel('Carrier answer')).not.toBeVisible();expect((await (await request.get('/api/state')).json()).state.escalations).toHaveLength(0);
 await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:'Save and forward to human team'}).click();await expect(panel).not.toBeVisible();await expect(page.getByText('Forwarded to our human agent team · simulated.',{exact:false})).toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;expect(state.shipments[0].status).toBe('unconfirmed');expect(state.reports[0].instant).toBeNull();expect(state.reports[0].delay).toBe(false);expect(state.escalations[0].reasons.map((r:any)=>r.reason)).toEqual(['ambiguous']);expect(state.audit.at(-1).details.heard).toContain(first);
 const turns=await page.evaluate(()=>(window as any).__conversationTurns);conversations.push({name:test.info().title,evidence:'mocked browser speech APIs; no real audio',turns});await page.reload();const persisted=(await (await request.get('/api/state')).json()).state;expect(persisted.escalations[0].id).toBe(state.escalations[0].id);
});

test('clear 5 AM plus date and timezone finishes without an unnecessary human issue',async({page,request})=>{
 await mockSpeech(page,['5am','11th of November 2026 Central time']);const panel=await open(page,false);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();await expect(panel.getByText("Thanks for the update. That's all I need.",{exact:true})).toBeVisible();const spoken=await page.evaluate(()=>(window as any).__spokenPrompts);expect(spoken[1]).toBe('Got the time. What date will you arrive, and which time zone is that?');await expect(panel.getByText('Arrival estimate ready',{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Save and forward to human team'})).toHaveCount(0);await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:'Save reviewed conversation'}).click();await expect(panel).not.toBeVisible();const state=(await (await request.get('/api/state')).json()).state;expect(state.reports[0].instant).toBe('2026-11-11T11:00:00Z');expect(state.escalations).toHaveLength(0);
});

for(const scenario of [
 {name:'spoken wrong number suppresses contact only after reviewed save',answers:['Wrong number'],outcome:'wrong_number',reason:'wrong_number',suppressed:true},
 {name:'spoken refusal suppresses contact only after reviewed save',answers:["I can't share that. Do not call again."],outcome:'refused',reason:'refused',suppressed:true},
 {name:'conflicting spoken times remain uncaptured after unsuccessful clarification',answers:['November eleventh, 2026 at three PM, actually four PM Central time',"I'm not sure",'No thanks'],outcome:'ambiguous',reason:'ambiguous',suppressed:false},
])test(scenario.name,async({page,request})=>{
 await mockSpeech(page,[...scenario.answers]);const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByText(scenario.outcome==='ambiguous'?'Understood. Thanks for the update.':"I'll pass this to our human agent team in this demo. Thank you for letting me know.",{exact:true})).toBeVisible();
 const before=(await (await request.get('/api/state')).json()).state;expect(before.attempts).toHaveLength(0);expect(before.contacts[0].suppressed).toBe(false);
 await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;expect(state.attempts).toHaveLength(1);expect(state.attempts[0].outcome).toBe(scenario.outcome);expect(state.reports[0].instant).toBeNull();expect(state.reports[0].capture).toBe('uncaptured');expect(state.contacts[0].suppressed).toBe(scenario.suppressed);expect(state.escalations[0].reasons.map((r:any)=>r.reason)).toContain(scenario.reason);expect(state.checks[0].status).toBe('finished');
});

test('interactive simulated handoff joins only on coordinator action and persists replies after review',async({page,request})=>{
 await mockSpeech(page,['We are five hours late','Yes please']);const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByText('Waiting for coordinator · simulated',{exact:true})).toBeVisible();
 expect((await (await request.get('/api/state')).json()).state.audit).toHaveLength(0);
 await panel.getByRole('button',{name:'Open coordinator desk'}).click();await expect(panel.getByText('Carrier reported a delay.',{exact:true})).toBeVisible();
 await expect(panel.getByLabel('Coordinator reply')).not.toBeVisible();await panel.getByRole('button',{name:'Join practice conversation'}).click();
 await panel.getByLabel('Coordinator reply').fill('I can help review the delay. What happened?');await panel.getByRole('button',{name:'Send practice reply'}).click();
 await panel.getByRole('button',{name:'Back to caller screen'}).click();await expect(panel.getByText('I can help review the delay. What happened?',{exact:true})).toBeVisible();
 await panel.getByLabel('Caller message').fill('The truck needs a repair.');await panel.getByRole('button',{name:'Send caller message'}).click();
 await panel.getByRole('button',{name:'Open coordinator desk'}).click();await expect(panel.getByText('The truck needs a repair.',{exact:true})).toBeVisible();await panel.getByRole('button',{name:'End practice conversation'}).click();await panel.getByRole('button',{name:'Back to caller screen'}).click();
 await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;const handoff=state.audit.at(-1).details.handoffSession;expect(handoff.status).toBe('ended');expect(handoff.mode).toBe('simulated_only');expect(handoff.messages).toHaveLength(2);expect(state.reports[0].instant).toBeNull();expect(state.escalations).toHaveLength(1);
 await page.reload();await page.getByRole('button',{name:'Activity',exact:true}).click();await expect(page.getByText('voice demo reviewed',{exact:true})).toBeVisible();await expect(page.getByText('Current issue:',{exact:false}).first()).toBeVisible();
});

test('consented synthetic microphone recording saves privately and plays after refresh',async({page,request})=>{
 await mockSpeech(page,['Tomorrow at three PM Central time']);const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();
 const recordBox=panel.getByRole('checkbox').nth(1);await expect(recordBox).not.toBeChecked();await recordBox.check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByText("Thanks for the update. That's all I need.",{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Stop recording',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Stop recording',exact:true}).click();await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:/Save (?:reviewed conversation|and forward to human team)/}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;const audio=state.audit.find((a:any)=>a.action==='conversation_audio_saved').details.recording;expect(audio.consent).toBe(true);expect(audio.coverage).toBe('microphone_only');expect(Date.parse(audio.expiresAt)-Date.parse(audio.createdAt)).toBe(7*86400000);
 const response=await request.get('/api/recordings/'+audio.id);expect(response.ok()).toBe(true);expect(response.headers()['cache-control']).toContain('no-store');expect((await response.body()).length).toBeGreaterThan(20);
 await page.reload();await page.getByRole('button',{name:'RG-1041',exact:true}).click();await page.getByRole('button',{name:'Load recording'}).click();await expect(page.locator('audio')).toBeVisible();await expect.poll(()=>page.locator('audio').evaluate((a:HTMLAudioElement)=>a.readyState)).toBeGreaterThanOrEqual(2);
 const forged=await request.post('/api/actions',{data:{type:'attach_audio',requestId:'forged',recording:audio}});expect(forged.status()).toBe(400);
});
