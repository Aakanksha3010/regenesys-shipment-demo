# Authenticated hosted persistence check — 8 November 2026

## Scope

Dedicated Regenesys Supabase project; existing authenticated owner/coordinator session in a separate Chrome tab. No credentials were collected, permissions changed, hosted reset performed, or external calls made. Mutations went through the application's UI and authenticated server endpoints. Supabase SQL was read-only corroboration. The user's existing unsaved draft was not saved or reloaded.

## Observed sequence

1. Created fictional **QA-PERSIST-1108**, Fictional test depot, Dallas → Fictional test dock, Houston, with a note identifying this persistence test.
2. Opened Talk with Bella, selected basic browser voice fallback, and used Type a practice reply. No microphone or recording consent was enabled; no ElevenLabs generation was needed.
3. Submitted: “Fictional persistence test: we will be 30 minutes late because of traffic.”
4. Accepted the simulated handoff, started the automatic practice coordinator, and submitted: “Fictional QA update: traffic is the cause; no confirmed arrival estimate yet.”
5. Ended practice, returned to the caller screen, checked the review checkbox and saved/forwarded.
6. Observed the successful saved/forwarded notice. Fully reloaded the test tab, waited for the existing authenticated session, and reopened the shipment.
7. Verified retained delay report, no captured ETA, finished check, open delay issue and reviewed audit entry.
8. Opened Activity and expanded the reviewed event: original typed text, accepted simulated handoff, ended automatic session, caller update and three scripted coordinator messages were present.
9. Opened Escalations: QA-PERSIST-1108 retained an open delay-reported issue and no ETA. The fictional test record remains available for inspection.

## Stored evidence

Read-only SQL confirmed attempt `attempt-e446bf05-200a-426d-87f8-e6c9ee98c5b8:start-1` is finished with `inputMethod: typed_demo`; report has `delay: true`, `capture: uncaptured`, `instant: null`; escalation is open with `delay_reported`. The `voice_demo_reviewed` audit details contain the same text and four-message `simulated_only` handoff observed after reload. UI attributes review to the signed-in owner; no scripted message is represented as a human-authored reply.

The database contained one Auth user and one coordinator membership. Anonymous and authenticated database roles cannot directly execute the save RPC; the app server requires valid sign-in and fresh workspace membership. Existing authorization tests cover rejection paths, but an actual second user was not provisioned or tested.

## Limits

This proves the authenticated typed conversation/handoff save path and history survive reload. It is not proof of real speech-recognition accuracy, microphone-plus-Bella recording upload/playback, seven-day physical deletion while offline, or another person's signup/email/sign-in/workspace access. No paid model-judge results are implied. The real microphone recovery flow still needs the user's device retest.
