# Bella conversation evaluations

Generated 2026-11-08T11:50:45.932646+00:00.

DeepEval 4.3.3: 47/47 local contract checks across 16 browser conversations.
17 non-applicable metric checks excluded; 3 records without a caller turn excluded.

React conversation outputs, mocked speech recognition and synthesis; no real audio.

LLM judge: NOT RUN: optional evaluator model/key required.

Audio metrics: NOT RUN: real audio, independent transcript reference and timing required.

These deterministic regression checks do not establish general conversational intelligence or acoustic quality.

| Conversation | Metric | Result |
| --- | --- | --- |
| speech conversation asks one clarification and saves only after review | Caller-facing language | PASS |
| speech conversation asks one clarification and saves only after review | Retain supplied slots | PASS |
| speech conversation asks one clarification and saves only after review | Truthful simulated handoff | PASS |
| spoken breakdown enters human queue without an invented ETA | Caller-facing language | PASS |
| spoken breakdown enters human queue without an invented ETA | Empathy and human help | PASS |
| spoken breakdown enters human queue without an invented ETA | Truthful simulated handoff | PASS |
| video regression: retain 3 p.m., ask date and zone only, offer delay handoff | Caller-facing language | PASS |
| video regression: retain 3 p.m., ask date and zone only, offer delay handoff | Retain supplied slots | PASS |
| video regression: retain 3 p.m., ask date and zone only, offer delay handoff | Empathy and human help | PASS |
| video regression: retain 3 p.m., ask date and zone only, offer delay handoff | Truthful simulated handoff | PASS |
| spoken 3 PM IST asks only for date, retains time and zone, and requires coordinator review | Caller-facing language | PASS |
| spoken 3 PM IST asks only for date, retains time and zone, and requires coordinator review | Retain supplied slots | PASS |
| spoken 3 PM IST asks only for date, retains time and zone, and requires coordinator review | Truthful simulated handoff | PASS |
| frustrated caller gets empathy and accepted demo hold never claims a human connected | Caller-facing language | PASS |
| frustrated caller gets empathy and accepted demo hold never claims a human connected | Empathy and human help | PASS |
| frustrated caller gets empathy and accepted demo hold never claims a human connected | Truthful simulated handoff | PASS |
| explicit human request offers help without another ETA question | Caller-facing language | PASS |
| explicit human request offers help without another ETA question | Empathy and human help | PASS |
| explicit human request offers help without another ETA question | Truthful simulated handoff | PASS |
| real retest regression: five hours late immediately offers a simulated handoff and preserves unconfirmed ETA | Caller-facing language | PASS |
| real retest regression: five hours late immediately offers a simulated handoff and preserves unconfirmed ETA | Empathy and human help | PASS |
| real retest regression: five hours late immediately offers a simulated handoff and preserves unconfirmed ETA | Truthful simulated handoff | PASS |
| screenshot 5 AM avoids repeated time questions and forwards uncertainty without claiming delay | Caller-facing language | PASS |
| screenshot 5 AM avoids repeated time questions and forwards uncertainty without claiming delay | Retain supplied slots | PASS |
| screenshot 5 AM avoids repeated time questions and forwards uncertainty without claiming delay | Truthful simulated handoff | PASS |
| clear 5 AM plus date and timezone finishes without an unnecessary human issue | Caller-facing language | PASS |
| clear 5 AM plus date and timezone finishes without an unnecessary human issue | Retain supplied slots | PASS |
| clear 5 AM plus date and timezone finishes without an unnecessary human issue | Truthful simulated handoff | PASS |
| spoken wrong number suppresses contact only after reviewed save | Caller-facing language | PASS |
| spoken wrong number suppresses contact only after reviewed save | Truthful simulated handoff | PASS |
| spoken refusal suppresses contact only after reviewed save | Caller-facing language | PASS |
| spoken refusal suppresses contact only after reviewed save | Truthful simulated handoff | PASS |
| conflicting spoken times remain uncaptured after unsuccessful clarification | Caller-facing language | PASS |
| conflicting spoken times remain uncaptured after unsuccessful clarification | Retain supplied slots | PASS |
| conflicting spoken times remain uncaptured after unsuccessful clarification | Truthful simulated handoff | PASS |
| automatic scripted coordinator intake | Caller-facing language | PASS |
| automatic scripted coordinator intake | Empathy and human help | PASS |
| automatic scripted coordinator intake | Truthful simulated handoff | PASS |
| leaving a scripted coordinator stops audio and retains the unsaved draft | Caller-facing language | PASS |
| leaving a scripted coordinator stops audio and retains the unsaved draft | Empathy and human help | PASS |
| leaving a scripted coordinator stops audio and retains the unsaved draft | Truthful simulated handoff | PASS |
| live ninth-November utterance keeps 5 PM and repairs same-timezone wording once | Caller-facing language | PASS |
| live ninth-November utterance keeps 5 PM and repairs same-timezone wording once | Retain supplied slots | PASS |
| live ninth-November utterance keeps 5 PM and repairs same-timezone wording once | Truthful simulated handoff | PASS |
| sending a typed caller reply cancels an unfinished microphone turn before coordinator audio | Caller-facing language | PASS |
| sending a typed caller reply cancels an unfinished microphone turn before coordinator audio | Empathy and human help | PASS |
| sending a typed caller reply cancels an unfinished microphone turn before coordinator audio | Truthful simulated handoff | PASS |
