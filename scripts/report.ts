import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {captureFixtures} from '../tests/fixtures.js';
import {seed,transition,localActor} from '../src/domain.js';

// Labels are independent expected instants/reasons, shared with the unit fixtures.
const rows=captureFixtures.map(([id,name,ending,text,clarification,instant,reasons])=>{
 let s=seed();const shipmentId=s.shipments[0].id;
 s=transition(s,{type:'request',requestId:id+'-start',shipmentId},localActor);
 s=transition(s,{type:'event',requestId:id+'-end',attemptId:s.attempts[0].id,providerEventId:id,payload:{ending,text,clarification}},localActor);
 const report=s.reports[0],issue=s.escalations[0];
 return {id,name,expectedCapture:instant!==null,capture:report.capture==='captured',correctInstant:report.instant===instant,required:reasons.length>0,escalated:!!issue,reasonsMatch:reasons.every(r=>issue?.reasons.some(x=>x.reason===r))};
});
const positive=rows.filter(x=>x.expectedCapture),negative=rows.filter(x=>!x.expectedCapture),required=rows.filter(x=>x.required),notRequired=rows.filter(x=>!x.required);
const correct=positive.filter(x=>x.capture&&x.correctInstant).length,falseCaptures=negative.filter(x=>x.capture).length,covered=required.filter(x=>x.escalated&&x.reasonsMatch).length,falseAlerts=notRequired.filter(x=>x.escalated).length;
const extensions=JSON.parse(await readFile('validation/extensions-results.json','utf8'));
const provider=JSON.parse(await readFile('validation/provider-results.json','utf8'));
const voice=JSON.parse(await readFile('validation/voice-results.json','utf8'));
const domain=JSON.parse(await readFile('validation/domain-results.json','utf8'));
const database=JSON.parse(await readFile('validation/database-results.json','utf8'));
const browser=JSON.parse(await readFile('validation/browser-results.json','utf8'));
const pct=(n:number,d:number)=>`${n}/${d} (${(100*n/d).toFixed(1)}%)`;
const body=`# SIMULATED validation report

Generated ${new Date().toISOString()}. Fixture labels test deterministic logic; these are not real-call or market-performance measurements.

## Automated checks

- Shipment dictation, handoff, access control and audio history: ${extensions.tests.filter((x:{passed:boolean})=>x.passed).length}/${extensions.tests.length} passed.
- Domain: ${domain.tests.filter((x:{passed:boolean})=>x.passed).length}/${domain.tests.length} passed; ${domain.persistedTransitions} transitions replayed through SQL with snapshot and relational projection checks.
- PostgreSQL constraints and transactions (PGlite): ${database.tests.filter((x:{passed:boolean})=>x.passed).length}/${database.tests.length} passed.
- Voice interpretation and persistence: ${voice.tests.filter((x:{passed:boolean})=>x.passed).length}/${voice.tests.length} passed.
- ElevenLabs adapter with mocked HTTP: ${provider.tests.filter((x:{passed:boolean})=>x.passed).length}/${provider.tests.length} passed.
- Chrome UI: ${browser.stats.expected} passed, ${browser.stats.unexpected} failed, ${browser.stats.skipped} skipped, ${browser.stats.flaky} flaky.

Separate reports cover [labelled transcript evaluations](EVALS.md) and [DeepEval multi-turn checks](CONVERSATION-EVALS.md). DeepEval uses actual UI-produced turns with mocked speech, with paired good/bad metric calibration tests. Optional model judging and real-audio metrics have not run.

## Capture and escalation scoring

This scoring subset uses ${rows.length} labelled initial-call fixtures. Retry, correction, concurrency and manual-entry behaviors are tested separately above; they are not included in these denominators.

| Metric | Result |
| --- | --- |
| Exact ETA capture among expected captures | ${pct(correct,positive.length)} |
| False captures among expected non-captures | ${falseCaptures}/${negative.length} |
| Required escalation with every expected reason | ${pct(covered,required.length)} |
| False alerts among fixtures requiring no escalation | ${falseAlerts}/${notRequired.length} |

| Fixture | Description | Result |
| --- | --- | --- |
${rows.map(r=>`| ${r.id} | ${r.name} | ${(r.expectedCapture?r.capture&&r.correctInstant:!r.capture)&&(r.required?r.escalated&&r.reasonsMatch:!r.escalated)?'PASS':'FAIL'} |`).join('\n')}

## Verification boundaries

The dedicated hosted Supabase project has both migrations and eight fictional seed shipments. SQL smoke checks verified the seed, RLS on all 12 tables, and service-only mutation privileges. Server-to-Supabase reads and coordinator membership were verified after local credential setup. An authenticated browser voice save to hosted Supabase has not been exercised; the existing in-app browser connection failed during this attempt. Purva’s own Auth account and membership acceptance remain pending. Browser tests use local mode with an explicitly simulated identity.

ElevenLabs supplies natural agent speech; browser speech synthesis is an explicitly selected fallback. The real ElevenLabs key successfully listed voices and generated a Bella MP3 preview on 7 November 2026. Browser speech recognition supplies input. Automated speech tests use controlled API doubles; actual microphone recognition and mixed Bella recording still require a user trial in a supported browser. Synthetic browser audio capture, private local save and playback after refresh were verified. The dedicated hosted audio bucket is private; service byte roundtrip and anonymous download denial were verified, and the synthetic test object was removed. Seven-day playback expiry and cleanup are unit-tested; physical deletion depends on the server running. No real calls, LLM extraction, external notifications, deployment, or production-readiness assessment occurred. Real-call connection rate: not applicable.
`;
await mkdir('validation',{recursive:true});await writeFile('validation/REPORT.md',body);
console.log(`Report written. Exact captures ${correct}/${positive.length}; false captures ${falseCaptures}; escalation coverage ${covered}/${required.length}; false alerts ${falseAlerts}.`);
if(extensions.tests.some((x:{passed:boolean})=>!x.passed)||provider.tests.some((x:{passed:boolean})=>!x.passed)||voice.tests.some((x:{passed:boolean})=>!x.passed)||falseCaptures||falseAlerts||correct!==positive.length||covered!==required.length||domain.tests.some((x:{passed:boolean})=>!x.passed)||database.tests.some((x:{passed:boolean})=>!x.passed)||browser.stats.unexpected)process.exitCode=1;
