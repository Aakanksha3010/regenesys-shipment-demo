import {test,expect,type Page} from '@playwright/test';

// These are controlled API doubles, not proof of real microphone/recognition quality.
async function mockSpeech(page:Page,answers:string[],error?:string){
 await page.addInitScript(({answers,error})=>{
  class Recognition {
   onresult:any;onend:any;onerror:any;aborted=false;
   start(){setTimeout(()=>{if(this.aborted)return;if(error)this.onerror?.({error});else this.onresult?.({results:[{isFinal:true,0:{transcript:answers.shift()||''}}]});this.onend?.();},30);}
   stop(){this.onend?.();}abort(){this.aborted=true;}
  }
  Object.defineProperty(window,'SpeechRecognition',{value:Recognition,configurable:true});
  let current:any;
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel:()=>{current=null;},speak:(u:any)=>{current=u;setTimeout(()=>{if(current===u)u.onend?.();},30);}},configurable:true});
 },{answers,error});
}
async function open(page:Page){await page.goto('/');await page.getByRole('button',{name:'RG-1041',exact:true}).click();await page.getByRole('button',{name:'Start voice demo',exact:true}).click();return page.getByRole('dialog',{name:'Voice demo — no phone call',exact:true});}
test.beforeEach(async({request})=>{const config=await (await request.get('/api/config')).json();expect(config.mode,'Browser tests must use isolated local mode').toBe('local');expect((await request.post('/api/reset',{data:{confirm:'RESET DEMO'}})).ok()).toBeTruthy();});

test('speech conversation asks one clarification and saves only after review',async({page,request})=>{
 await mockSpeech(page,['Tomorrow at three thirty PM','Central time']);const panel=await open(page);
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
 await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
 await expect(panel.getByLabel('Carrier answer')).toHaveValue('Truck broke down, not sure when');
 await expect(panel.getByText('Human review required',{exact:true})).toBeVisible();
 await expect(panel.getByRole('checkbox').last()).toBeEnabled();await panel.getByRole('checkbox').last().check();
 await panel.getByRole('button',{name:'Save reviewed voice demo'}).click();await expect(panel).not.toBeVisible();
 const state=(await (await request.get('/api/state')).json()).state;expect(state.reports[0].capture).toBe('uncaptured');expect(state.escalations[0].reasons.map((r:any)=>r.reason)).toContain('delay_reported');
});
test('microphone denial offers a labelled typed fallback and saves nothing automatically',async({page,request})=>{
 await mockSpeech(page,[],'not-allowed');const panel=await open(page);await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Start conversation'}).click();
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
