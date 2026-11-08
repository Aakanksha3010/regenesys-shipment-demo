# Real audio evaluation

Status: protocol prepared; a real ElevenLabs Bella MP3 generation succeeded on 7 November 2026. The user accepted Bella as warm and natural. On 8 November, the user confirmed testing the ElevenLabs voice and that the UI was fine. No per-scenario recognition results, timings, mixed recording or completed hosted save/refresh were specified; those remain unverified. Automated speech API doubles do not count as real audio results.

## Procedure

Use fictional details. Open a shipment → Start voice demo. Select ElevenLabs, preview Bella, then try Jessica if a brighter style is preferred. Record browser/device, voice, date, background condition and recognizer language. Check the app's simulation date before saying “tomorrow”.

For each trial, record the intended sentence, the actual displayed transcript, proposed ETA/reasons, whether one clarification occurred, and the reviewed saved result. Never mark a trial successful merely because manual transcript editing repaired a recognition error. Preserve both original recognition and reviewed text; record edits explicitly. Optional recording now requires separate consent. It captures the microphone (and Bella when using ElevenLabs), excludes hold music/typed replies, and is attached only after review and save. Use the private audio-history flow; do not put recordings in the repository.

| Trial | Say | Expected before save |
| --- | --- | --- |
| A01 | November eleventh, 2026 at three thirty PM Central time | Nov 11, 21:30 UTC; on time |
| A02 | Tomorrow at four PM | One timezone clarification; no save without review |
| A03 | Maybe tomorrow at four PM Central time | Unconfirmed; human review unless independently complete clarification removes uncertainty |
| A04 | Truck broke down, no arrival estimate | Delay escalation; no invented ETA |
| A05 | November eleventh at three PM, actually four PM Central time | Conflict; no automatic capture |
| A06 | Wrong number | Unconfirmed; reviewed save suppresses fictional contact |
| A07 | Silence / deny microphone | Clear input error; no automatic saved check |
| A08 | Close dialog while speech loads or plays | Audio stops; no late playback and no saved check |

Repeat A01–A05 with at least two speakers and both quiet and moderately noisy conditions. Do not combine these observations with scripted logic scores.

## Measurements

- Recognition: exact date/time/timezone matches, failures, and manual corrections, with counts and denominator.
- Interpretation: false captures and required escalations using the intended utterance and actual recognized transcript separately.
- Audio: voice clarity, warmth, naturalness and appropriate enthusiasm rated 1–5 by the listener. User acceptance determines the chosen voice; no rating is prefilled.
- Timing: click-to-first-audio and end-of-answer-to-agent-response, measured in seconds; report every sample and median only after enough trials.
- Persistence: no rows before review; after save, exactly one check, attempt and canonical event, correct report/issue, signed-in reviewer attribution; refresh and verify persistence.

Live carrier calls, telephony connection rates, and real-world operating performance are outside this protocol.

Synthetic browser recording and playback are tested separately from acoustic quality. A fake browser audio device is used in automation; this does not prove real-device recognition, Bella mixing, or naturalness.
