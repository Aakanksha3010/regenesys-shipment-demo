# Bella conversation review in the development chat

Reviewed 7 November 2026 against source commit `a255046`.

This is a qualitative review by the assistant in the same development chat, using the existing conversation exports. It made no additional model API calls. It is not an independent, blinded evaluation or a run of DeepEval's automated LLM judges. The reviewer has implementation context and possible author bias. Automated model judging remains **NOT RUN**; real-audio evaluation remains **NOT RUN**.

## Evidence and rubric

Source: local `validation/conversations-results.json`, SHA-256 `54e835178fcc4d1df8b1139a073d63618e5f80460132f8dad8392beccedab7f7`. Nine records contain seven conversations with caller turns. The microphone-denial and voice-sample records contain no caller turn and are excluded from conversation ratings. These are actual React outputs driven by mocked speech APIs, not recordings of live calls.

Each conversation was read for relevance, retention of supplied information, preservation of uncertainty, appropriate response to delay or human requests, and truthful simulation wording. Ratings are **satisfactory within the observed turns**, **needs attention**, or **not assessable**. No numeric quality score or general pass rate is inferred from this small, selected regression set. Test names are identifiers, not proof of database outcomes.

| Conversation | Assessment | Evidence and reasoning |
| --- | --- | --- |
| One clarification: tomorrow at three thirty PM → Central time | Satisfactory within the observed turns | Bella retains the supplied date/time and asks only for the zone. The closing is relevant. The transcript alone does not prove how “tomorrow” was resolved or whether the saved value was correct; the interface explicitly uses a demo clock. A spoken readback would make interpretation easier for the caller to check. |
| Truck breakdown, arrival unknown | Satisfactory within the observed turns | Bella acknowledges the delay and immediately offers a clearly simulated handoff without inventing an ETA or demanding another date. The export ends at the offer, so acceptance, coordinator interaction and persistence are not assessed here. |
| 3 PM → 30-minute delay → declined handoff | Satisfactory within the observed turns | Bella initially asks only for the missing date and zone, then switches to a delay response when new information arrives. She does not compute an arrival from an unresolved baseline. The declined roleplay is respected. Mandatory escalation after review/save must be checked in state tests, not inferred from the spoken closing. |
| 3 PM IST → November eleventh, 2026 | Needs attention outside the declared demo convention | Bella retains time and zone and asks only for the date, matching the current demo contract. Source inspection confirms a visible convention that IST means India Standard Time and a matching normalizer. The spoken exchange does not establish that meaning with the caller. For broader use, ask which timezone they mean or confirm the full zone before accepting it. This is a limitation of the demo convention, not evidence that the current test failed. |
| Frustrated caller → accepted handoff | Needs attention | The apology acknowledges frustration without repeating ETA questions. However, the initial offer asks whether the caller wants to speak with a human coordinator; only after “Yes please” does Bella disclose that the caller must play the coordinator role. State that the offered handoff is simulated before asking for agreement. The subsequent hold prompt is explicit and truthful. |
| Explicit request for a human → declined offer | Needs attention | Bella stops ETA questioning, but asks the caller to repeat their already expressed choice and offers help reaching a human without a simulation qualifier. Because the caller declines, no later spoken clarification appears in this export. Offer the simulated coordinator desk explicitly and avoid implying access to a live person. |
| Five hours late from today's time → declined handoff | Satisfactory within the observed turns | Bella recognizes the reported delay, immediately offers a clearly labelled simulation, and does not invent an absolute arrival time. The closing respects the declined roleplay. The transcript does not establish the final escalation record. |

## Follow-up priorities

1. Make the human-request and frustration offers identify the simulated coordinator desk before the caller accepts. Add a regression that checks the initial offer, including the declined branch; checking only the later hold prompt is insufficient.
2. Preserve the documented IST demo convention for current acceptance reporting, but add ambiguous-zone examples to the broader evaluation set. Before expanding beyond the guided demo, require explicit timezone identification or confirmation. Do not silently reinterpret an existing approved demo convention as a tested general capability.
3. Consider a brief date/time/full-timezone readback for complete ETA captures. This is a proposed usability improvement, not a demonstrated current requirement violation.
4. Independently test saved escalation state after declining roleplay. Expand conversation coverage to refusals, wrong numbers, conflicting corrections, silence and actual coordinator exchanges; their behavior cannot be inferred from these seven transcripts.

The existing DeepEval report records **22/22 deterministic contract checks**. These findings show why that result does not establish unrestricted conversational quality: narrow checks can miss an implication in the initial human-help offer or an unspoken timezone convention.

## What this cannot establish

Naturalness of Bella's audio, intelligibility, microphone recognition accuracy, interruptions, latency, real human availability, or correctness of hosted saves cannot be measured from these text exports. The previously accepted voice preview is a useful user observation, not an acoustic benchmark. Dynamic caller simulation and automated model judging have not run. No paid API setup is required to retain the local checks or repeat this documented chat-review process.

## Follow-up — 8 November

The initial human-request and frustration offers now explicitly describe the simulation before agreement. Browser regressions check the first offer in accepted and declined paths. The local handoff metric now detects undisclosed initial offers even when a later hold prompt discloses simulation; paired calibration tests cover that gap.

Three additional browser conversations cover wrong number, refusal and unresolved conflicting times, including reviewed persistence and suppression. The new conflict case exposed an evaluator false positive: a conflicting time is not a settled supplied time. The retention metric now allows clarification for explicit corrections/ranges while continuing to check known dates/zones, with good/bad calibration examples. No product fixture outcome or score threshold was changed to hide an application failure.

The refreshed result is 29/29 local checks over 10 conversations, with 8 calibration tests passing. This does not replace the historical seven-conversation review above or constitute a new independent LLM judgment. The agreed IST demo convention is unchanged. New source wording awaits coordinated activation in the user's served app.
