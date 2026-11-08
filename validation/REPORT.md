# SIMULATED validation report

Generated 2026-11-08T09:25:39.224Z. Fixture labels test deterministic logic; these are not real-call or market-performance measurements.

## Automated checks

- Shipment dictation, handoff, access control and audio history: 14/14 passed.
- Domain: 66/66 passed; 218 transitions replayed through SQL with snapshot and relational projection checks.
- PostgreSQL constraints and transactions (PGlite): 15/15 passed.
- Voice interpretation and persistence: 17/17 passed.
- ElevenLabs adapter with mocked HTTP: 5/5 passed.
- Chrome UI: 30 passed, 0 failed, 0 skipped, 0 flaky.

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
