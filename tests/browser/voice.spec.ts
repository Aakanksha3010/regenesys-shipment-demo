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
async function open(page:Page){await page.goto('/');await page.getByRole('button',{name:'RG-1041',exact:true}).click();await page.getByRole('button',{name:'Start voice demo',exact:true}).click();return page.getByRole('dialog',{name:'Voice demo — no phone call',exact:true});}
test.beforeEach(async({request})=>{const config=await (await request.get('/api/config')).json();expect(config.mode,'Browser tests must use isolated local mode').toBe('local');expect((await request.post('/api/reset',{data:{confirm:'RESET DEMO'}})).ok()).toBeTruthy();});

test('speech conversation asks one clarification and saves only after review',async({page,request})=>{
 await mockSpeech(page,['Tomorrow at three thirty PM','Central time']);const panel=await open(page);
 await panel.getByLabel('Agent audio').selectOption('browser');
 await expect(panel.getByRole('button',{name:'Start conversation'})).toBeDisabled();
 await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByLabel('Clarification answer')).toHaveValue('Central time');
 await expect(panel.getByRole('button',{name:'Save reviewed voice demo'})).toBeDisabled();
 expect((await (await request.get('/api/state')).json()).state.attempts).toHaveLength(0);
 await page.screenshot({path:test.info().outputPath('voice-demo.png'),fullPage:true});
 await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:'Save reviewed voice demo'}).click();
 await expect(panel).not.toBeVisible();const state=(await (await request.get('/api/state')).json()).state;
 expect(state.reports[0].instant).toBe('2026-11-11T21:30:00Z');expect(state.attempts[0].inputMethod).toBe('browser_voice');
});
test('spoken breakdown enters human queue without an invented ETA',async({page,request})=>{
 await mockSpeech(page,['Truck broke down, not sure when']);const panel=await open(page);
 await panel.getByLabel('Agent audio').selectOption('browser');
 await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByLabel('Carrier answer')).toHaveValue('Truck broke down, not sure when');
 await expect(panel.getByText('Human review required',{exact:true})).toBeVisible();
 await expect(panel.getByRole('checkbox').last()).toBeEnabled();await panel.getByRole('checkbox').last().check();
 await panel.getByRole('button',{name:'Save reviewed voice demo'}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;expect(state.reports[0].capture).toBe('uncaptured');expect(state.escalations[0].reasons.map((r:any)=>r.reason)).toContain('delay_reported');
});
test('microphone denial offers a labelled typed fallback and saves nothing automatically',async({page,request})=>{
 await mockSpeech(page,[],'not-allowed');const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByRole('alert')).toContainText('denied');
 expect((await (await request.get('/api/state')).json()).state.attempts).toHaveLength(0);
 await panel.getByLabel('Carrier answer').fill('Wrong number');await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:'Save reviewed voice demo'}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;expect(state.contacts[0].suppressed).toBe(true);expect(state.attempts[0].inputMethod).toBe('typed_demo');
});
test('closing a voice draft discards it without a stuck check',async({page,request})=>{
 const panel=await open(page);await panel.getByLabel('Carrier answer').fill('tomorrow at 3 PM Central time');await panel.getByRole('button',{name:'Close dialog'}).click();
 expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
});
test('voice entry is usable on mobile and transcript edits revoke review',async({page})=>{
 await page.setViewportSize({width:390,height:844});const panel=await open(page);await panel.getByLabel('Carrier answer').fill('tomorrow at 3 PM Central time');await panel.getByRole('checkbox').last().check();await panel.getByLabel('Carrier answer').fill('maybe tomorrow at 3 PM Central time');await expect(panel.getByRole('button',{name:'Save reviewed voice demo'})).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('natural voice requires setup and browser fallback is an explicit choice',async({page,request})=>{
 const panel=await open(page);await expect(panel.getByText('ElevenLabs is not connected yet.',{exact:false})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Preview voice'})).toBeDisabled();
 expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
 await panel.getByLabel('Agent audio').selectOption('browser');await expect(panel.getByRole('button',{name:'Preview voice'})).toBeEnabled();
});
test('ElevenLabs preview uses selected voice and provider failure never falls back silently',async({page,request})=>{
 await page.route('**/api/voice/options',route=>route.fulfill({json:{configured:true,voices:[{id:'voiceA',name:'Warm voice',description:'Conversational'},{id:'voiceB',name:'Clear voice',description:'Clear and friendly'}]}}));
 let payload:any;await page.route('**/api/voice/speech',route=>{payload=route.request().postDataJSON();return route.fulfill({status:503,json:{error:'ElevenLabs usage unavailable for test'}});});
 const panel=await open(page);await panel.getByLabel('Agent voice').selectOption('voiceB');await panel.getByRole('button',{name:'Preview voice'}).click();
 await expect(panel.getByRole('alert')).toHaveText('ElevenLabs usage unavailable for test');expect(payload).toEqual({prompt:'preview',voiceId:'voiceB'});
 await expect(panel.getByLabel('Agent audio')).toHaveValue('elevenlabs');expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
});
test('closing while natural audio loads prevents late playback',async({page})=>{
 await page.route('**/api/voice/options',route=>route.fulfill({json:{configured:true,voices:[{id:'voiceA',name:'Warm voice',description:''}]}}));
 let release!:()=>void;const waiting=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/voice/speech',async route=>{await waiting;await route.fulfill({status:503,json:{error:'Delayed result'}}).catch(()=>{});});
 const panel=await open(page);await panel.getByRole('button',{name:'Preview voice'}).click();await expect(panel.getByText('Agent speaking…')).toBeVisible();await panel.getByRole('button',{name:'Close dialog'}).click();release();await expect(panel).not.toBeVisible();
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
 await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:'Save reviewed voice demo'}).click();await expect(panel).not.toBeVisible();
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
 const spoken=await page.evaluate(()=>(window as any).__spokenPrompts);expect(spoken[1]).toContain("I'm sorry this has been frustrating");expect(spoken[2]).toContain("a real person won't join");
 await panel.getByRole('button',{name:'Stop audio'}).click();await expect(panel.getByRole('button',{name:'Save reviewed voice demo'})).toBeDisabled();
 expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
});

test('explicit human request offers help without another ETA question',async({page,request})=>{
 await mockSpeech(page,['I want to speak to a human','No thanks']);const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByText('Understood. Thanks for the update.',{exact:true})).toBeVisible();
 const spoken=await page.evaluate(()=>(window as any).__spokenPrompts);expect(spoken[1]).toContain('human coordinator');expect(spoken[1]).not.toMatch(/date|time zone|arrival time/);
 await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:'Save reviewed voice demo'}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;expect(state.escalations[0].reasons.map((r:any)=>r.reason)).toContain('human_requested');expect(state.contacts[0].suppressed).toBe(false);
});

test('real retest regression: five hours late immediately offers a simulated handoff and preserves unconfirmed ETA',async({page,request})=>{
 const answer="we'll be arriving five hours late from today's time";
 await mockSpeech(page,[answer,'No thanks']);const panel=await open(page);await panel.getByLabel('Agent audio').selectOption('browser');await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByText('Understood. Thanks for the update.',{exact:true})).toBeVisible();
 const spoken=await page.evaluate(()=>(window as any).__spokenPrompts);
 expect(spoken).toHaveLength(3);expect(spoken[1]).toMatch(/sorry.*human coordinator.*demo.*preview/i);
 expect(spoken[1]).not.toMatch(/got the date|what time|time zone|connected|AM or PM/i);
 expect((await (await request.get('/api/state')).json()).state.checks).toHaveLength(0);
 await panel.getByRole('checkbox').last().check();await panel.getByRole('button',{name:'Save reviewed voice demo'}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;
 expect(state.reports[0].instant).toBeNull();expect(state.reports[0].capture).toBe('uncaptured');expect(state.reports[0].assessment).toBe('delay');
 expect(state.escalations[0].reasons.map((r:any)=>r.reason)).toContain('delay_reported');expect(state.audit.at(-1).details.handoffChoice).toBe('declined');
});
