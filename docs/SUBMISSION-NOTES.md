# Regenesys demo submission notes

Updated 8 November 2026. This is a single-company **simulated shipment coordination demo**, not a live carrier-calling deployment.

## Deliverables

- [Public source repository](https://github.com/Aakanksha3010/regenesys-shipment-demo).
- [Setup](../README.md), [walkthrough](WALKTHROUGH.md), and SQL migrations.
- [Automated validation](../validation/REPORT.md), [labelled transcript evals](../validation/EVALS.md), [DeepEval conversation report](../validation/CONVERSATION-EVALS.md).
- [DeepEval runner and instructions](../evals/README.md), [real-audio test protocol](../evals/AUDIO-CHECKS.md).

The localhost URL is available only on the machine running the app. A reviewer can clone and run local mode without cloud credentials. The app has not been deployed to a public application URL. Private credentials and source planning documents are excluded from the public repository/archive.

## Demonstrate

1. Open RG-1041 and run the on-time scripted check. Show the sourced ETA, check lifecycle and attempt history.
2. Open RG-1042 and run a late response. Acknowledge, annotate and resolve the human issue; resolution retains the delay history.
3. Run a no-answer/retry case and a wrong-number case. Show immediate escalation, retry cap and contact suppression.
4. Choose Talk with Bella. Say “3 PM IST”, then “November eleventh, 2026”. Only the date should be requested; IST is explicitly defined as India Standard Time.
5. Repeat with “expect the shipment to arrive at 3:00 p.m.”, then “There is a 30-minute delay”. Bella retains the time, offers human help, and does not manufacture 3:30 PM or a missing date.
6. Say “I already told you, this is frustrating”. Hear empathy and a human-help offer. Accept the simulated handoff, open the coordinator desk, explicitly join and send a practice reply. Return to the caller screen to respond. You play both roles; no external person joins.
7. Show the separate coordinator review and save the fictional result. Caller-facing speech does not discuss transcripts, saving or backend issues.

## Verified

- Dedicated Supabase schema and service-only access; company/escalation projections use security-invoker views. One coordinator account can sign in and read the dashboard.
- Manual entry, edits before a check, retirement, separate statuses, ETA comparison, conservative parsing, immediate escalation, retry/suppression, corrections and history.
- Provenance and configurable simulation-clock expiry; audit snapshots are detached from mutable records.
- ElevenLabs credentials can list available voices and generate a Bella MP3. The user accepted the preview as warm and natural.
- Automated checks include the reported partial-time conversation, IST date-only follow-up, 30-minute delay, frustration, explicit human request, handoff acceptance/decline, cancellation and review-before-save.
- Detailed counts and timestamps are in the generated reports. Text and mocked-browser results are not acoustic measurements.

## Remaining acceptance checks

| Item | Status / dependency |
| --- | --- |
| Voice and UI experience | User confirms testing ElevenLabs voice and says UI is fine (8 November); detailed scenario accuracy and timings not supplied |
| Signed-in hosted reviewed save | Pending; inspect saved rows and attribution, then refresh to confirm persistence |
| Additional user accounts | General signup/sign-in UI implemented; a second account must confirm email and receive approved membership. Actual sign-in, shared data and role checks remain |
| Model-judged DeepEval scores | Not run; no paid evaluator requested or used. Local deterministic checks and a separately labelled chat review are available |
| Recorded audio metrics | Not run; permitted recordings, reference transcripts and timings required |
| Original PRD source transfer | Private source register still records the earlier failed local download; no reconstructed original is presented |

## Live handoff is a future integration

Live calling, a real hold queue and human pickup need a telephony/voice session provider, configured destination/queue, an available human, transfer callbacks, timeout/decline/no-agent handling and an authorized end-to-end test. A transfer request or hold music must never be labelled “human connected” without a verified pickup event. The current app performs none of these real-phone operations.

Intent recognition is a bounded rule set. It is not an open-ended conversational LLM or proof of general intent/emotion understanding. Human review is retained for uncertain information. There are no SMS/WhatsApp messages, carrier negotiations, receiving-site calls or external notifications.

Before wider use, review the pre-existing Supabase helper execution warnings and disabled leaked-password protection documented in the README. No compliance or production-readiness claim is made.

## Follow-up from the real microphone retest

The reported utterance “we'll be arriving five hours late from today's time” exposed a missing hour-duration delay pattern. The follow-up fix recognizes the delay immediately, responds empathetically, and offers only a simulated handoff. Current-clock references and unresolved estimate offsets are not converted into an arrival date/time/timezone. The exact report and its follow-up are regression fixtures; the user subsequently confirmed testing the voice/UI, but did not provide the exact five-hour-delay outcome or saved-state result.

## Added for the reviewer walkthrough

- Plain-language shipment actions, a useful Company directory, searchable Ask guidance and a What's new panel.
- Voice-assisted Add shipment: dictate the labelled fields, fill the form, edit any mistakes, confirm every field, then save. Extraction does not guess missing fields.
- Interactive simulated coordinator desk: context, transcript, explicit join, editable/dictated replies, caller responses and end state. Review and save persists the exchange in Activity without changing an unconfirmed ETA.
- Optional consented audio history in a private bucket, with seven-day playback expiry. Synthetic browser capture/playback and hosted storage denial checks passed; real-device mixed audio and signed-in hosted attachment checks remain pending.
- Additional users share the existing Regenesys workspace through their own approved accounts. Account creation does not automatically grant membership.

Physical audio deletion runs while the app is running and at startup. An always-on cleanup job is still required for strict seven-day deletion while the local app is offline. The app is not publicly deployed, so a remote reviewer cannot open this machine's localhost URL.

## Screenshot feedback follow-up

Voice samples now use a non-question greeting and explicit microphone-off labels. The sample cannot start recognition; microphone consent and Start conversation are required. The duplicate Hear agent control was removed. Scripted controls are labelled Test scenarios and explain their purpose separately from Talk with Bella.

Partial shipment dictation no longer clears existing details. Common window label variants and America Chicago are understood; day-first, explicit-year dates can differ across an overnight window. Missing years and ambiguous compact times such as 344 PM are not guessed. The UI lists changed fields and targeted corrections, and still requires review before saving. Consecutive applied dictations remain in the saved source text.

## Current follow-up

See [the 8 November status and focused retest](STATUS-2026-11-08.md). Human-request and frustration prompts now disclose the simulated handoff before acceptance, with regression checks. These source changes have not replaced the user’s served build during active testing. Nothing has been submitted or shared with a reviewer.
