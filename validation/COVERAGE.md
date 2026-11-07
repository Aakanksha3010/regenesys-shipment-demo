# Demo requirement coverage

The user-approved amended implementation plan is retained outside the public application repository. This map connects its scenario IDs to executable evidence; original requirements are not overwritten by implementation notes.

| Requirement / scenario family | Evidence |
| --- | --- |
| S01–S06, S09–S18: capture, delay, ambiguity, clarification, ranges/conflicts, boundaries, midnight, DST, early arrival | `tests/fixtures.ts`, `tests/domain.test.ts`; every accepted transition in these tests is replayed through SQL and checked against all relational projections |
| S07a–e, S08, S28, S34–S36: retries and check lifecycle | Domain tests, DB retry-cap constraint, browser retry walkthrough |
| S19–S25: corrections, stale reports, status precedence, resolution/reopening, timeout/late events | Domain tests and SQL replay; browser correction/delay/resolution cases |
| S26–S27: canonical events and request idempotency | Domain tests, immutable history checks, canonical-event preservation and duplicate payload fingerprint |
| S29: concurrent requests and manual retries | Database tests S29 and S29b |
| S30: atomic rollback | Forced database constraint failure; snapshot and relational records unchanged |
| S31–S32: suppression and human review | Domain tests and browser suppression walkthrough |
| S33: simulated-only boundary | Database rejects live mode; dashboard/detail label checks; generated reports and walkthrough clearly labelled |
| F1–F6: manual entry, validation, edits, retirement | Domain + SQL replay, browser entry and mobile forms |
| Auth / role separation | Unit viewer-write rejection; database browser-role denial; hosted coordinator sign-in/read verified. Second real viewer browser check pending |
| Voice extension | `tests/voice.test.ts`, `tests/browser/voice.spec.ts`, `tests/voice-provider.test.ts` |
| Text evals | Independently labelled `evals/cases.ts`; generated `EVALS.md` |
| Whole conversation evals | Actual browser-emitted turns with mocked speech; DeepEval custom metrics; `CONVERSATION-EVALS.md` |
| Real audio and live phone behavior | Not established by the above tests; separate protocol and dependencies in submission notes |

The November 7 scope extension explicitly adds voice IST as India Standard Time, targeted clarification, human-request/frustration intents, caller-facing empathy and a simulated hold preview. Eval V34's expectation changed for this explicit IST decision; V41 retains a separate unsupported-timezone negative case. No other failing fixture was relabelled merely to make a test pass.

Remaining end-to-end acceptance items are listed in [submission notes](../docs/SUBMISSION-NOTES.md). Presence of an ID in this map is not a claim that a real carrier call or every possible utterance was tested.
