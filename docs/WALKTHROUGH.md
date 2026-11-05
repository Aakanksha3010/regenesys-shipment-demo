# SIMULATED demo walkthrough

All interactions use fictional data. The original walkthrough uses scripted responses; the voice extension below lets you play the carrier. No carrier is contacted.

1. Start with a clean local demo: Company → Reset local demo → enter `RESET DEMO`. The dashboard shows eight shipments and no issues.
2. Open **RG-1041**. Choose **Request ETA (simulated)**, then **Play scripted response**. The shipment becomes On time reported; Latest ETA shows a carrier-reported estimate, source and timestamp. No escalation is created.
3. Open **RG-1042** and repeat. Its late estimate creates a human escalation. Acknowledge it, then resolve it with a meaningful note. The issue resolves but the shipment still shows Delay reported. Review the history.
4. Open **RG-1043** and play its first response. No answer creates an escalation immediately, with a pending retry. Run the pending simulated retry and play its response. The new ETA is on time; the human issue stays open until reviewed.
5. Open **RG-1044** and play its wrong-number response. Confirm that the contact is suppressed and a new request is blocked. Use the contact review action with a reason to clear suppression. The review is recorded.
6. Open **RG-1045**, start its check, then record a human ETA correction before playing the response. Supply a date/time, timezone and reason. Play the breakdown response: Latest ETA keeps the human value while delay evidence creates an immediate escalation.
7. Add a shipment with a unique reference and a valid delivery window, using a fictional seeded contact. Choose an on-time scenario, save, then request/play its check. Pre-check details can be edited with a reason; post-check identity/route/window changes are locked. Retirement preserves history and reserves its reference.
8. Use Activity to inspect actors, timestamps and changes. Use Company to see the fixed company configuration and simulation clock. Advancing the simulation clock allows timeout testing; no wall-clock scheduler calls anyone.

Additional scenarios are selectable in a shipment's demo controls when no check is active. This control changes the next scripted outcome for demonstrations; it does not represent editing a carrier's report. Try voicemail, refusal, a range, conflicting times, dropped-call delay evidence and incomplete timezone clarification.

To repeat: reset the local demo. Hosted reset is disabled. Hosted verification should use new fictional shipment references and real Supabase sign-in; it must not be described as verified until exercised.

## Browser voice extension

1. Open a shipment with no active check and an unsuppressed contact. Select **Start voice demo**.
2. Read the microphone disclosure, opt in, then select **Start conversation**. Allow microphone access yourself when prompted. The app speaks first, then listens. Use Chrome if the embedded browser reports speech recognition unavailable.
3. Say: “November eleventh, 2026 at three thirty PM Central time.” Or omit the timezone to hear one clarification. Dates use the visible simulation clock.
4. The agent proposes a result. Try “Truck broke down, not sure when” to see a human escalation, or “Wrong number” to see contact suppression proposed. Tentative estimates such as “maybe tomorrow at three PM” remain unconfirmed.
5. Review and, if needed, correct the transcript. Check **I reviewed the transcript and proposed result**, then **Save reviewed voice demo**. The server computes the result again; it never trusts a browser-provided ETA or assessment.
6. Inspect the resulting shipment, issue and call history. Browser voice and typed demos are labelled separately from scripted fixtures. Delay/uncertainty creates an issue on save; nothing is persisted before review.

Closing a draft stops audio and discards it. Listening has a 25-second limit; speech-service errors never invent an answer. A draft is rejected if the workspace changes before save, preventing it from overwriting a newer human correction. Failed saves can be retried with the same request ID without creating a duplicate check. If a concurrency warning appears, close the draft, refresh, and begin again.

The app retains reviewed transcript text and the original recognized text for audit; it does not store audio. Your browser may process audio through its own speech service. Do not use real carrier or customer information in this demo. Automated speech tests use mocks; confirm microphone and playback behavior with your own trial.
