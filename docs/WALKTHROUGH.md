# SIMULATED demo walkthrough

All interactions use fictional data. The original walkthrough uses scripted responses; the voice extension below lets you play the carrier. No carrier is contacted.

1. Start with a clean local demo: Company → Practice controls → Reset local practice data → enter `RESET DEMO`. The dashboard shows eight shipments and no issues.
2. Open **RG-1041**. Choose **Start practice check**, then **Play scripted response**. The shipment becomes On time reported; Latest ETA shows a carrier-reported estimate, source and timestamp. No escalation is created.
3. Open **RG-1042** and repeat. Its late estimate creates a human escalation. Choose Take ownership, then Mark resolved with a meaningful note. The issue resolves but the shipment still shows Delay reported. Review the history.
4. Open **RG-1043** and play its first response. No answer creates an escalation immediately, with a pending retry. Run the pending simulated retry and play its response. The new ETA is on time; the human issue stays open until reviewed.
5. Open **RG-1044** and play its wrong-number response. Confirm that the contact is suppressed and a new request is blocked. Use the contact review action with a reason to clear suppression. The review is recorded.
6. Open **RG-1045**, start its check, then record a human ETA correction before playing the response. Supply a date/time, timezone and reason. Play the breakdown response: Latest ETA keeps the human value while delay evidence creates an immediate escalation.
7. Add a shipment with a unique reference and a valid delivery window, using a fictional seeded contact. Choose an on-time scenario, save, then request/play its check. Pre-check details can be edited with a reason; post-check identity/route/window changes are locked. Retirement preserves history and reserves its reference.
8. Use Activity to inspect actors, timestamps and changes. Use Company to see the sample carrier directory and practice controls. Advancing the simulation clock allows timeout testing; no wall-clock scheduler calls anyone.

Additional scenarios are selectable in a shipment's demo controls when no check is active. This control changes the next scripted outcome for demonstrations; it does not represent editing a carrier's report. Try voicemail, refusal, a range, conflicting times, dropped-call delay evidence and incomplete timezone clarification.

To repeat: reset the local demo. Hosted reset is disabled. Hosted verification should use new fictional shipment references and real Supabase sign-in; it must not be described as verified until exercised.

## Browser voice extension

1. Open a shipment with no active check and an unsuppressed contact. Select **Talk with Bella**.
2. Read the microphone disclosure, opt in, then select **Start conversation**. Allow microphone access yourself when prompted. The app speaks first, then listens. Use Chrome if the embedded browser reports speech recognition unavailable.
3. Say: “November eleventh, 2026 at three thirty PM Central time.” Or omit the timezone to hear one clarification. Dates use the visible simulation clock.
4. The agent proposes a result. Try “Truck broke down, not sure when” to see a human escalation, or “Wrong number” to see contact suppression proposed. Tentative estimates such as “maybe tomorrow at three PM” remain unconfirmed.
5. Review and, if needed, correct the transcript. Check **I checked the outcome and any practice replies**, then **Save reviewed conversation** or **Save and forward to human team**, as shown. Conversation details stay collapsed unless you want to inspect or correct them. The server computes the result again; it never trusts a browser-provided ETA or assessment.
6. Inspect the resulting shipment, issue and call history. Browser voice and typed demos are labelled separately from scripted fixtures. Delay/uncertainty creates an issue on save; nothing is persisted before review.

Closing a draft stops audio and discards it. Listening has a 25-second limit; speech-service errors never invent an answer. A draft is rejected if the workspace changes before save, preventing it from overwriting a newer human correction. Failed saves can be retried with the same request ID without creating a duplicate check. If a concurrency warning appears, close the draft, refresh, and begin again.

The app retains reviewed transcript text and the original recognized text for audit; audio is stored only with the separate recording consent and reviewed save. Your browser may process audio through its own speech service. Do not use real carrier or customer information in this demo. Automated speech tests use mocks; confirm microphone and playback behavior with your own trial.

## Interactive handoff

Say “We are five hours late” and accept the simulated handoff. During/after hold music, choose **Open coordinator desk**. Review the shipment and conversation context, then **Join practice conversation**. Type or dictate a coordinator reply and send the practice reply. **Back to caller screen** shows that reply and allows a caller response. End the practice conversation from the coordinator screen, then review and save. You play both roles. No real telephone transfer or external participant is connected.

## Voice-assisted shipment entry

Choose **Add shipment → Fill with your voice**. Dictate using the example field labels. Select **Fill fields from description**, correct all extracted details and complete any blank fields. Check the field-review box before saving. Editing a field revokes that confirmation. Both new and existing shipment drafts retain fields you did not dictate. Spoken delay clauses after the route are separated into Additional description / shipment note, preserving uncertainty and existing notes. You can also say “Additional description” explicitly. The form identifies updated fields and explains unresolved dates or times. The practice scenario remains a separately selected simulation setting.

## Optional recording

Before starting a conversation, separately consent to recording. The microphone and Bella can be recorded with ElevenLabs; browser speech fallback records the microphone only. The recording indicator and Stop/Discard controls stay available. Review and save, then find **Conversation recordings** in the shipment. Reload and choose **Load recording** to verify persisted playback. Hold music and typed replies are not in the audio; practice replies remain in the text history. Playback expires after seven days. File cleanup runs while the server is up and at startup; it cannot run while the machine is offline.

## Help and reviewer login

**Ask** in the header opens searchable guides. The bell opens **What's new**, and **Help** provides the full guide. These are written product instructions, not a live support channel.

Each reviewer should create their own account, confirm their email if required, and receive access from the owner. They share the same Regenesys workspace using their own credentials. The localhost app is not remotely hosted; a public app URL and Auth redirect settings are required before a remote reviewer can use it on another machine. Actual reviewer signup, access assignment and hosted save/refresh must be checked before claiming that handoff complete.
