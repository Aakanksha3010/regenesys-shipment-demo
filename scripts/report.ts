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
const domain=JSON.parse(await readFile('validation/domain-results.json','utf8'));
const database=JSON.parse(await readFile('validation/database-results.json','utf8'));
const browser=JSON.parse(await readFile('validation/browser-results.json','utf8'));
const pct=(n:number,d:number)=>`${n}/${d} (${(100*n/d).toFixed(1)}%)`;
const body=`# SIMULATED validation report

Generated ${new Date().toISOString()}. Fixture labels test deterministic logic; these are not real-call or market-performance measurements.

## Automated checks

- Domain: ${domain.tests.filter((x:{passed:boolean})=>x.passed).length}/${domain.tests.length} passed.
- PostgreSQL constraints and transactions (PGlite): ${database.tests.filter((x:{passed:boolean})=>x.passed).length}/${database.tests.length} passed.
- Chrome UI: ${browser.stats.expected} passed, ${browser.stats.unexpected} failed, ${browser.stats.skipped} skipped, ${browser.stats.flaky} flaky.

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

The dedicated hosted Supabase project has the migration and eight fictional seed shipments. SQL smoke checks verified the seed, RLS on all 12 tables, and service-only mutation privileges. Hosted browser sign-in and server-to-Supabase operation remain unverified until a server key and Auth user are configured. Browser tests use local mode with an explicitly simulated identity.

No real calls, speech recognition, LLM extraction, external notifications, deployment, or production-readiness assessment occurred. Real-call connection rate: not applicable.
`;
await mkdir('validation',{recursive:true});await writeFile('validation/REPORT.md',body);
console.log(`Report written. Exact captures ${correct}/${positive.length}; false captures ${falseCaptures}; escalation coverage ${covered}/${required.length}; false alerts ${falseAlerts}.`);
if(falseCaptures||falseAlerts||correct!==positive.length||covered!==required.length||domain.tests.some((x:{passed:boolean})=>!x.passed)||database.tests.some((x:{passed:boolean})=>!x.passed)||browser.stats.unexpected)process.exitCode=1;
