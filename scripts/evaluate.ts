import {mkdir,writeFile} from 'node:fs/promises';
import {cases,type EvalCase} from '../evals/cases.js';
import {captureFixtures} from '../tests/fixtures.js';
import {seed,transition,localActor,type Action} from '../src/domain.js';
const baseline:EvalCase[]=captureFixtures.map(([id,category,ending,text,clarification,expectedInstant,reasons])=>({id,category,ending,text,clarification,expectedInstant,reasons}));
const results=[...baseline,...cases].map(c=>{
 let s=seed();let error:string|undefined;
 try{
 if(c.ending){s=transition(s,{type:'request',shipmentId:'shipment-1',requestId:c.id+'-start'},localActor);s=transition(s,{type:'event',requestId:c.id+'-event',attemptId:s.attempts[0].id,payload:{ending:c.ending,text:c.text,clarification:c.clarification}},localActor);}
 else s=transition(s,{type:'voice_demo',requestId:c.id,shipmentId:'shipment-1',expectedVersion:0,reviewed:true,inputMethod:'typed_demo',text:c.text,clarification:c.clarification} as Action,localActor);
 }catch(e){error=String(e);}
 const report=s.reports.at(-1),reasons=s.escalations.flatMap(e=>e.reasons.map(r=>r.reason));
 const expectedCapture=c.expectedInstant!==null;
 const checks={noError:!error,capture:(report?.capture==='captured')===expectedCapture,instant:report?.instant===c.expectedInstant,reasons:[...new Set(reasons)].sort().join('|')===[...c.reasons].sort().join('|'),assessment:!c.assessment||report?.assessment===c.assessment,suppression:s.contacts[0].suppressed===(c.suppressed??false),terminal:s.attempts[0]?.status==='finished',provenance:report?.source==='carrier'&&!!report?.recordedAt,simulation:s.attempts[0]?.mode==='simulated'};
 // Scripted baseline labels did not carry suppression; derive from explicit transport outcome.
 if(c.ending==='refused'||c.ending==='wrong_number')checks.suppression=s.contacts[0].suppressed;
 return {id:c.id,category:c.category,passed:Object.values(checks).every(Boolean),checks,expected:c,actual:{capture:report?.capture,instant:report?.instant,assessment:report?.assessment,reasons,suppressed:s.contacts[0].suppressed},error};
});
const metrics=(rows:typeof results)=>{
 const positives=rows.filter(r=>r.expected.expectedInstant!==null),negatives=rows.filter(r=>r.expected.expectedInstant===null),required=rows.filter(r=>r.expected.reasons.length),notRequired=rows.filter(r=>!r.expected.reasons.length);
 return {cases:rows.length,passed:rows.filter(r=>r.passed).length,exactCaptures:{correct:positives.filter(r=>r.actual.capture==='captured'&&r.checks.instant).length,total:positives.length},falseCaptures:{count:negatives.filter(r=>r.actual.capture==='captured').length,total:negatives.length},escalationCoverage:{correct:required.filter(r=>r.expected.reasons.every(x=>r.actual.reasons.includes(x))).length,total:required.length},falseAlerts:{count:notRequired.filter(r=>r.actual.reasons.length).length,total:notRequired.length}};
};
const report={generatedAt:new Date().toISOString(),mode:'simulated-transcripts',baseline:metrics(results.filter(r=>r.id.startsWith('S')||r.id.startsWith('TZ'))),voiceAndAdversarial:metrics(results.filter(r=>r.id.startsWith('V'))),audioRecognition:'NOT TESTED: these are written transcripts, not audio recordings',results};
await mkdir('validation',{recursive:true});await writeFile('validation/eval-results.json',JSON.stringify(report,null,2));
const table=(m:ReturnType<typeof metrics>)=>`| Cases passing every check | ${m.passed}/${m.cases} |\n| Exact captured ETA | ${m.exactCaptures.correct}/${m.exactCaptures.total} |\n| False captures | ${m.falseCaptures.count}/${m.falseCaptures.total} |\n| Required escalation coverage | ${m.escalationCoverage.correct}/${m.escalationCoverage.total} |\n| False alerts | ${m.falseAlerts.count}/${m.falseAlerts.total} |`;
await writeFile('validation/EVALS.md',`# SIMULATED transcript evaluations\n\nGenerated ${report.generatedAt}. Hand-labelled written inputs test interpretation and state transitions, not speech recognition, real carrier behavior or statistical accuracy.\n\n## Original fixture baseline\n\n| Metric | Result |\n| --- | --- |\n${table(report.baseline)}\n\n## Additional voice and adversarial transcripts\n\n| Metric | Result |\n| --- | --- |\n${table(report.voiceAndAdversarial)}\n\n## Case results\n\n| ID | Category | Result | Failed checks |\n| --- | --- | --- | --- |\n${results.map(r=>`| ${r.id} | ${r.category} | ${r.passed?'PASS':'FAIL'} | ${Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k).join(', ')} |`).join('\n')}\n\nThe audio evaluation protocol is in evals/AUDIO-CHECKS.md. Real audio and authenticated hosted browser saves remain separate checks. A zero-error result on these fixtures does not establish general language understanding.\n`);
console.log(JSON.stringify({baseline:report.baseline,voiceAndAdversarial:report.voiceAndAdversarial,failures:results.filter(r=>!r.passed).map(r=>({id:r.id,expected:r.expected,actual:r.actual,error:r.error}))},null,2));
if(results.some(r=>!r.passed))process.exitCode=1;
