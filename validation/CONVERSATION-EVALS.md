# Bella conversation evaluations

Generated 2026-11-08T09:26:31.846785+00:00.

DeepEval 4.3.3: 29/29 local contract checks across 10 browser conversations.
11 non-applicable metric checks excluded; 2 records without a caller turn excluded.

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
| spoken wrong number suppresses contact only after reviewed save | Caller-facing language | PASS |
| spoken wrong number suppresses contact only after reviewed save | Truthful simulated handoff | PASS |
| spoken refusal suppresses contact only after reviewed save | Caller-facing language | PASS |
| spoken refusal suppresses contact only after reviewed save | Truthful simulated handoff | PASS |
| conflicting spoken times remain uncaptured after unsuccessful clarification | Caller-facing language | PASS |
| conflicting spoken times remain uncaptured after unsuccessful clarification | Retain supplied slots | PASS |
| conflicting spoken times remain uncaptured after unsuccessful clarification | Truthful simulated handoff | PASS |
