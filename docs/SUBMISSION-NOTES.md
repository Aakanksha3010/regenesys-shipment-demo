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
6. Say “I already told you, this is frustrating”. Hear empathy and a human-help offer. Accept the simulated handoff, open the coordinator desk, and start the automatic scripted coordinator. Speak or type as the caller and receive a reply. Say “that’s all” to finish, then return to review and save. Manual mode is available; no external person joins.
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
| Signed-in hosted reviewed save | Verified for typed practice conversation and simulated handoff on QA-PERSIST-1108; full reload, Activity and Escalations checked. Real microphone/audio attachment remains pending |
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

See [the 8 November status and focused retest](STATUS-2026-11-08.md). Human-request and frustration prompts now disclose the simulated handoff before acceptance, with regression checks. These changes were activated on 8 November after the user confirmed testing was finished; the served asset and sign-in boundary were verified. Nothing has been submitted or shared with a reviewer.

## Subsequent voice and dictation feedback — activated

The spoken description “destination Houston shipment could be 30 minutes delayed” is now split into destination Houston and an additional-description note. Existing notes are retained, repeated application does not duplicate the same note, and review remains required.

The reported “10th of November at 5 AM … within 24 hours … same as Texas” case now retains the supplied date/time and targets uncertainty and the missing explicit timezone. An approximate window or place name does not manufacture an exact ETA. Repeating 5 AM alone still leaves those details unresolved, but is not labelled a delay. A clear 5 AM followed by a date and Central time completes without an unnecessary human issue.

Conversation details are collapsed by default. A concise outcome explains the forwarding reason, and the save action forwards to the shared team queue with a confirmation after success. Uncertainty can use the same explicit simulated handoff path. No real transfer is claimed. Original conversation text remains in saved audit history.

The user returned and authorized continuing on 8 November. The app was rebuilt and started; HTTP 200 and served asset index-Dd4ciqxj.js were verified, including the targeted clarification, additional-description field, collapsed conversation details and human-team forwarding action. Supabase mode and HTTP 401 for unsigned state reads were also verified. Live acceptance remains pending. GitHub pushing is blocked by unavailable saved credentials; the application changes are committed locally.

Validation for this follow-up: 123 code/database tests and 82 labelled transcript cases passed; 35 deterministic conversation checks passed across 12 conversations. Chrome reported 32 passes plus one flaky case that passed its recorded retry (a detached-element timeout). An earlier run also encountered ERR_NETWORK_IO_SUSPENDED while loading the dashboard. These interruptions are retained as limitations, not reported as a completely clean first-pass run. Both new 5 AM browser regressions and the delay-note save/refresh test passed. No paid model judge or new live audio-quality result is claimed.


## Automatic practice coordinator — activated 8 November

The previous desk expected one tester to play both roles, so caller speech appeared as a coordinator message and received no reply. The default is now automatic scripted intake with caller-labelled spoken/typed turns, generic Bella replies, explicit finish, cancellation and written replies when playback fails. Manual roleplay remains optional. No general-purpose LLM or real human connection is claimed. The microphone uses a deliberate Speak caller response action for each turn. Only generic allowlisted prompts reach ElevenLabs.

Reviewed handoff caller messages can add delay/refusal/wrong-number evidence; coordinator scripts cannot. These messages never establish a new ETA or resolve the issue. All writes still require review and save. The screenshot parser also accepts plural shipment-reference labels and flags an obvious fragment such as “used in” without guessing Houston.

Validation: 129/129 code/database tests; 82/82 labelled transcript evals; 47/47 local conversation checks across 16 conversations; TypeScript and production build passed. The 30-case voice/entry browser run passed. After final coordinator wording changes, all 25 voice cases passed again; the added microphone-cancellation case also passed (31 distinct targeted browser cases). An earlier disclosure-wording regression was corrected before these successful runs. Browser audio/recognition were mocked, not real microphone accuracy measurements. Paid model judging was not run.

The local production server was restarted with user approval and serves index-DWgMWZu0.js. GitHub synchronization remains blocked by unavailable saved authentication; this change is local until that is restored.

### Live speech-capture follow-up

Read-only inspection of the user's open Chrome draft found the first recognized sentence stopped at "expected to arrive but tomorrow that is night"; the time appeared only in the follow-up "5:00 p.m. same time zone". The reported full spoken sentence included "tomorrow, that is ninth November at 5 PM". These are distinct evidence: intended speech versus the text actually captured.

Capture now uses continuous recognition with a 1.8-second final-result pause before ending, plus Finish speaking and existing cancellation/time limits. Dictation uses the same pause tolerance. Sending a typed reply cancels an unfinished microphone turn before coordinator speech. One bounded extra timezone clarification handles "same time zone as yours"; it never assumes the agent's timezone.

A separate regression prevents a conflicting relative/calendar date from silently rolling into next year. The seeded demo clock is November 10: "tomorrow" and "November 9" conflict under that clock. With a November 8 test clock, the exact November 9 / 5 PM sentence plus explicit Central Time resolves correctly. These are controlled tests, not proof of live ASR accuracy. The user's unsaved draft was inspected, not saved or refreshed.


## Shipment dictation: uncertain delay must not block a clear route

The exact screenshot sentence "shipment reference would be RG 1054 and origin is Alaska destination is Houston and be might get 30 minutes late" previously split only the duration into a note, leaving "might get" in the destination. The global uncertainty check then skipped all route fields. The parser now preserves the complete delay clause, including the recognizer's wording and uncertainty, and scopes uncertain labelled details to their own field. A leading qualifier such as "Maybe origin ..." remains conservative.

Expected draft: reference RG-1054, origin Alaska, destination Houston, note "be might get 30 minutes late". It does not infer a corrected pronoun or a confirmed delay/ETA. Existing values remain unchanged when their replacement is uncertain, and review is still required before save.

Validation: 21/21 related code/database tests, 6/6 entry browser checks, TypeScript and production build passed. The frontend was rebuilt while retaining the old assets. No server restart, user-draft refresh, or hosted save was performed. Reload when ready to receive the fix. GitHub synchronization remains blocked by the previously reported credential problem.


## Timeout recovery and contextual handoff — activated 8 November

The timezone-listening timeout now keeps the first answer and offers Retry microphone, an editable draft reply, and End without a reply. Partial recognition is never silently accepted. A finalized answer is processed even if the browser fails to emit its end event. An unanswered arrival follow-up no longer displays a premature forwarding outcome; ending without a reply leaves the arrival unconfirmed. Recording remains separately controlled.

Texas alone is not an explicit timezone. Bella asks Central or Mountain while retaining the supplied date/time. The simulated coordinator receives the shipment, earlier date/time/timezone statements, and unresolved date conflict. It can ask the remaining question without starting over. Scripted coordinator messages never confirm an ETA. Dates use the visible November 10 practice clock; “tomorrow, ninth of November” is conflicting under that clock.

Validation: 132/132 code/database tests and 82/82 labelled transcript evaluations passed. The 31-case voice browser run initially had 28 passes and three failures: two case-sensitive assertions and one real context issue where “not sure” hid a date conflict. After fixes, all five targeted recovery/context/persistence checks passed, as did 24 voice unit tests, TypeScript, lint and production build. This is not a claim of a new clean whole-suite browser run or paid model judging. The served build is index-D_EwIEp7.js.

Authenticated hosted persistence is now verified for the typed practice conversation/handoff, through the real owner session: fictional QA-PERSIST-1108 was saved, fully reloaded and reopened. Activity retained the reviewed caller text and four handoff messages; Escalations retained the open delay issue with no captured ETA. Read-only Supabase queries independently confirmed the records. See [hosted evidence](../validation/HOSTED-PERSISTENCE-2026-11-08.md). This supersedes earlier pending hosted-save statements for this typed path only. The original user draft was neither saved nor refreshed.

Still pending: real microphone retry acceptance, consented microphone-plus-Bella recording save/playback, and a second account's signup/email confirmation/sign-in/approved workspace access. One owner account and membership were observed. GitHub synchronization remains blocked by unavailable saved credentials; local changes are not claimed as pushed.


## On-time shipment dictation boundary — 8 November

The screenshot sentence “shipment shipment reference RG 1055 origin from Alaska destination to Minnesota and we would be on time” now fills RG-1055, Alaska, Minnesota, and the note “we would be on time”. The punctuated spoken variant with “R G one zero five five” is also covered. Route labels consume their leading from/to prepositions; on-time clauses are separated like delay clauses, preserving negation and uncertainty. A note does not create an ETA report or change the selected practice scenario.

Validation: 22/22 related code/database tests, 7/7 Chrome entry/UI tests, TypeScript and isolated production build passed. The browser regression checks both utterances, review-before-save and note persistence after reload. Recognition in these automated tests is text/mocked input, not an acoustic accuracy measurement.

The tested frontend was installed with existing assets retained. HTTP verified index-DR3_ffmj.js is served, and downloaded bytes matched the tested asset. No server restart, user-tab refresh, or hosted data mutation occurred. An already-open tab needs a reload to use the changed parser; its unsaved draft is untouched. GitHub synchronization remains blocked by the existing credential issue.
