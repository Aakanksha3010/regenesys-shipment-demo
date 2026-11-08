# SIMULATED validation report

Generated 2026-11-08T09:51:53.830Z. Fixture labels test deterministic logic; these are not real-call or market-performance measurements.

## Automated checks

- Shipment dictation, handoff, access control and audio history: 17/17 passed.
- Domain: 66/66 passed; 218 transitions replayed through SQL with snapshot and relational projection checks.
- PostgreSQL constraints and transactions (PGlite): 15/15 passed.
- Voice interpretation and persistence: 20/20 passed.
- ElevenLabs adapter with mocked HTTP: 5/5 passed.
- Chrome UI: 32 passed, 0 failed, 0 skipped, 1 flaky.

Separate reports cover [labelled transcript evaluations](EVALS.md) and [DeepEval multi-turn checks](CONVERSATION-EVALS.md). DeepEval uses actual UI-produced turns with mocked speech, with paired good/bad metric calibration tests. Optional model judging and real-audio metrics have not run.

## Capture and escalation scoring

This scoring subset uses 25 labelled initial-call fixtures. Retry, correction, concurrency and manual-entry behaviors are tested separately above; they are not included in these denominators.

| Metric | Result |
| --- | --- |
| Exact ETA capture among expected captures | 10/10 (100.0%) |
| False captures among expected non-captures | 0/15 |
| Required escalation with every expected reason | 18/18 (100.0%) |
| False alerts among fixtures requiring no escalation | 0/7 |

| Fixture | Description | Result |
| --- | --- | --- |
| S01 | complete | PASS |
| S01b | relative date | PASS |
| S01c | year inference | PASS |
| S02 | late ETA | PASS |
| S03a | explicit delay inside window | PASS |
| S03b | breakdown without ETA | PASS |
| S04 | ambiguous | PASS |
| S05a | clarify timezone | PASS |
| S05b | missing timezone | PASS |
| S06a | clarify date | PASS |
| S06b | missing date | PASS |
| S09a | dropped fragment | PASS |
| S09b | dropped complete-looking ETA | PASS |
| S09c | dropped explicit delay | PASS |
| S10 | wrong number | PASS |
| S11 | refused | PASS |
| S12 | range | PASS |
| S13 | conflict | PASS |
| S14a | inclusive window end | PASS |
| S14b | one minute late | PASS |
| S16b | unresolved midnight | PASS |
| S17b | DST gap unresolved | PASS |
| S18 | early | PASS |
| TZ1 | ambiguous CST | PASS |
| TZ2 | DST overlap | PASS |

## Verification boundaries

The dedicated hosted Supabase project has both migrations and eight fictional seed shipments. SQL smoke checks verified the seed, RLS on all 12 tables, and service-only mutation privileges. Server-to-Supabase reads and coordinator membership were verified after local credential setup. An authenticated browser voice save to hosted Supabase has not been exercised; the existing in-app browser connection failed during this attempt. Actual second-account signup, membership and role acceptance remain pending. A read-only hosted check on 8 November found one coordinator member, one scripted attempt and no reviewed voice saves or recording metadata; browser voice persistence therefore remains unverified on the hosted project. Browser tests use local mode with an explicitly simulated identity.

ElevenLabs supplies natural agent speech; browser speech synthesis is an explicitly selected fallback. The real ElevenLabs key successfully listed voices and generated a Bella MP3 preview on 7 November 2026. Browser speech recognition supplies input. Automated speech tests use controlled API doubles; the user confirmed testing the ElevenLabs voice and UI on 8 November. Detailed recognition accuracy, mixed Bella recording and a saved/refresh trial still lack specific acceptance results. Synthetic browser audio capture, private local save and playback after refresh were verified. The dedicated hosted audio bucket is private; service byte roundtrip and anonymous download denial were verified, and the synthetic test object was removed. Seven-day playback expiry and cleanup are unit-tested; physical deletion depends on the server running. No real calls, LLM extraction, external notifications, deployment, or production-readiness assessment occurred. Real-call connection rate: not applicable.


## Supplementary 8 November coordinator and capture checks

The latest code/database run passed 129/129 tests; labelled transcript evals passed 82/82; local conversation contracts passed 47/47 across 16 recorded test conversations. The 30-case voice/entry browser run passed, then 25/25 voice cases passed after final coordinator wording updates. One additional microphone-cancellation test passed, for 31 distinct targeted browser cases. This supplements the earlier full-suite browser report above rather than claiming a new whole-suite run.

Coverage includes automatic scripted caller/coordinator turns, optional manual roleplay, reviewed persistence of delay/refusal evidence, no ETA from scripted messages, stopped audio and microphone cancellation, the plural shipment-reference screenshot, unclear destination handling, the exact ninth-November/5 PM utterance, and capture across a pause. Controlled recognition/synthesis doubles do not establish real audio quality or live recognition accuracy. No paid model judging was run.


## Timeout recovery and contextual handoff — activated 8 November

The timezone-listening timeout now keeps the first answer and offers Retry microphone, an editable draft reply, and End without a reply. Partial recognition is never silently accepted. A finalized answer is processed even if the browser fails to emit its end event. An unanswered arrival follow-up no longer displays a premature forwarding outcome; ending without a reply leaves the arrival unconfirmed. Recording remains separately controlled.

Texas alone is not an explicit timezone. Bella asks Central or Mountain while retaining the supplied date/time. The simulated coordinator receives the shipment, earlier date/time/timezone statements, and unresolved date conflict. It can ask the remaining question without starting over. Scripted coordinator messages never confirm an ETA. Dates use the visible November 10 practice clock; “tomorrow, ninth of November” is conflicting under that clock.

Validation: 132/132 code/database tests and 82/82 labelled transcript evaluations passed. The 31-case voice browser run initially had 28 passes and three failures: two case-sensitive assertions and one real context issue where “not sure” hid a date conflict. After fixes, all five targeted recovery/context/persistence checks passed, as did 24 voice unit tests, TypeScript, lint and production build. This is not a claim of a new clean whole-suite browser run or paid model judging. The served build is index-D_EwIEp7.js.

Authenticated hosted persistence is now verified for the typed practice conversation/handoff, through the real owner session: fictional QA-PERSIST-1108 was saved, fully reloaded and reopened. Activity retained the reviewed caller text and four handoff messages; Escalations retained the open delay issue with no captured ETA. Read-only Supabase queries independently confirmed the records. See [hosted evidence](HOSTED-PERSISTENCE-2026-11-08.md). This supersedes earlier pending hosted-save statements for this typed path only. The original user draft was neither saved nor refreshed.

Still pending: real microphone retry acceptance, consented microphone-plus-Bella recording save/playback, and a second account's signup/email confirmation/sign-in/approved workspace access. One owner account and membership were observed. GitHub synchronization remains blocked by unavailable saved credentials; local changes are not claimed as pushed.


## On-time shipment dictation boundary — 8 November

The screenshot sentence “shipment shipment reference RG 1055 origin from Alaska destination to Minnesota and we would be on time” now fills RG-1055, Alaska, Minnesota, and the note “we would be on time”. The punctuated spoken variant with “R G one zero five five” is also covered. Route labels consume their leading from/to prepositions; on-time clauses are separated like delay clauses, preserving negation and uncertainty. A note does not create an ETA report or change the selected practice scenario.

Validation: 22/22 related code/database tests, 7/7 Chrome entry/UI tests, TypeScript and isolated production build passed. The browser regression checks both utterances, review-before-save and note persistence after reload. Recognition in these automated tests is text/mocked input, not an acoustic accuracy measurement.

The tested frontend was installed with existing assets retained. HTTP verified index-DR3_ffmj.js is served, and downloaded bytes matched the tested asset. No server restart, user-tab refresh, or hosted data mutation occurred. An already-open tab needs a reload to use the changed parser; its unsaved draft is untouched. GitHub synchronization remains blocked by the existing credential issue.
