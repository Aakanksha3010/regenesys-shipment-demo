# SIMULATED demo walkthrough

All interactions below use fictional data and scripted responses. No carrier is contacted.

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
