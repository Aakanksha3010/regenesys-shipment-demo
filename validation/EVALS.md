# SIMULATED transcript evaluations

Generated 2026-11-08T12:19:50.195Z. Hand-labelled written inputs test interpretation and state transitions, not speech recognition, real carrier behavior or statistical accuracy.

## Original fixture baseline

| Metric | Result |
| --- | --- |
| Cases passing every check | 25/25 |
| Exact captured ETA | 10/10 |
| False captures | 0/15 |
| Required escalation coverage | 18/18 |
| False alerts | 0/7 |

## Additional voice and adversarial transcripts

| Metric | Result |
| --- | --- |
| Cases passing every check | 57/57 |
| Exact captured ETA | 20/20 |
| False captures | 0/37 |
| Required escalation coverage | 41/41 |
| False alerts | 0/16 |

## Case results

| ID | Category | Result | Failed checks |
| --- | --- | --- | --- |
| S01 | complete | PASS |  |
| S01b | relative date | PASS |  |
| S01c | year inference | PASS |  |
| S02 | late ETA | PASS |  |
| S03a | explicit delay inside window | PASS |  |
| S03b | breakdown without ETA | PASS |  |
| S04 | ambiguous | PASS |  |
| S05a | clarify timezone | PASS |  |
| S05b | missing timezone | PASS |  |
| S06a | clarify date | PASS |  |
| S06b | missing date | PASS |  |
| S09a | dropped fragment | PASS |  |
| S09b | dropped complete-looking ETA | PASS |  |
| S09c | dropped explicit delay | PASS |  |
| S10 | wrong number | PASS |  |
| S11 | refused | PASS |  |
| S12 | range | PASS |  |
| S13 | conflict | PASS |  |
| S14a | inclusive window end | PASS |  |
| S14b | one minute late | PASS |  |
| S16b | unresolved midnight | PASS |  |
| S17b | DST gap unresolved | PASS |  |
| S18 | early | PASS |  |
| TZ1 | ambiguous CST | PASS |  |
| TZ2 | DST overlap | PASS |  |
| V01 | spoken numbers | PASS |  |
| V02 | spoken numbers | PASS |  |
| V03 | relative date | PASS |  |
| V04 | clarification | PASS |  |
| V05 | clarification | PASS |  |
| V06 | uncertain | PASS |  |
| V07 | uncertain | PASS |  |
| V08 | uncertain | PASS |  |
| V09 | uncertain | PASS |  |
| V10 | uncertain clarification | PASS |  |
| V11 | uncertain clarification | PASS |  |
| V12 | conflict | PASS |  |
| V13 | conflict | PASS |  |
| V14 | conflict | PASS |  |
| V15 | range | PASS |  |
| V16 | self correction | PASS |  |
| V17 | delay | PASS |  |
| V18 | delay | PASS |  |
| V19 | delay | PASS |  |
| V20 | delay clarification | PASS |  |
| V21 | negated delay | PASS |  |
| V22 | refusal | PASS |  |
| V23 | refusal | PASS |  |
| V24 | wrong number | PASS |  |
| V25 | voicemail | PASS |  |
| V26 | no answer | PASS |  |
| V27 | boundary | PASS |  |
| V28 | late | PASS |  |
| V29 | early | PASS |  |
| V30 | DST gap | PASS |  |
| V31 | DST overlap | PASS |  |
| V32 | invalid date | PASS |  |
| V33 | invalid time | PASS |  |
| V34 | IST explicitly supported | PASS |  |
| V35 | timezone ambiguity | PASS |  |
| V36 | missing time | PASS |  |
| V37 | irrelevant numbers | PASS |  |
| V38 | failed transport | PASS |  |
| V39 | failed transport delay | PASS |  |
| V40 | instructions in answer | PASS |  |
| V41 | unsupported timezone | PASS |  |
| V42 | date-only followup | PASS |  |
| V43 | recorded video regression | PASS |  |
| V44 | delay instead of missing date | PASS |  |
| V45 | human request | PASS |  |
| V46 | frustrated caller | PASS |  |
| V47 | negated delay | PASS |  |
| V48 | declined human help | PASS |  |
| V49 | real retest: relative five-hour delay | PASS |  |
| V50 | real retest: unresolved baseline and timezone | PASS |  |
| V51 | current clock is not an arrival estimate | PASS |  |
| V52 | negated duration delay | PASS |  |
| V53 | screenshot: known 5 AM but unclear window and zone | PASS |  |
| V54 | 5 AM retained with day-first date and zone followup | PASS |  |
| V55 | day-first spoken date | PASS |  |
| V56 | arrival window cannot become a precise capture | PASS |  |
| V57 | exact live retest: retain 5 AM and do not label uncertainty as delay | PASS |  |

The audio evaluation protocol is in evals/AUDIO-CHECKS.md. Real audio and authenticated hosted browser saves remain separate checks. A zero-error result on these fixtures does not establish general language understanding.
