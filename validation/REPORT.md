# SIMULATED validation report

Generated 2026-11-05T21:01:45.264Z. Fixture labels test deterministic logic; these are not real-call or market-performance measurements.

## Automated checks

- Domain: 62/62 passed.
- PostgreSQL constraints and transactions (PGlite): 13/13 passed.
- Chrome UI: 6 passed, 0 failed, 0 skipped, 0 flaky.

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

The dedicated hosted Supabase project has the migration and eight fictional seed shipments. SQL smoke checks verified the seed, RLS on all 12 tables, and service-only mutation privileges. Hosted browser sign-in and server-to-Supabase operation remain unverified until a server key and Auth user are configured. Browser tests use local mode with an explicitly simulated identity.

No real calls, speech recognition, LLM extraction, external notifications, deployment, or production-readiness assessment occurred. Real-call connection rate: not applicable.
