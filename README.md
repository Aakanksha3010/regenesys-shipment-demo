# Regenesys Shipment Coordination Demo

A **SIMULATED**, single-company shipment workspace: run a browser voice conversation or a scripted carrier ETA check, review delays and uncertainty, and keep a human-owned escalation queue. All carriers, people, contacts and shipments are fictional. A reported ETA is an estimate, not a guaranteed arrival.

## Run locally

Requires Node.js 24 and npm. From the repository root:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open **http://127.0.0.1:4173**. Local mode uses embedded PostgreSQL (PGlite), persists in `.data/postgres`, and clearly identifies its coordinator as simulated. It requires no cloud credentials. Company → Reset local demo restores the eight seed shipments after typing `RESET DEMO`.

## What works

- Manual shipment entry, validation, pre-check edits, retirement, filters and search.
- Eighteen scripted scenarios, including late ETA, voicemail, dropped calls, wrong numbers, refusals, ambiguous dates and a successful retry.
- Separate shipment, check, call-attempt and escalation state; one active check per shipment.
- Immediate human escalation for delay or uncertainty; one simulated automatic retry for eligible failures. The demo operator explicitly advances the retry; there is no background dialler.
- Wrong-number/refusal suppression until a documented human review.
- Human ETA corrections, notes, acknowledgement, resolution and reopening with preserved history. New call evidence cannot overwrite a newer human ETA correction, but reported delays and failures still reach the queue.
- UTC-normalized ETA comparisons with named timezone handling, conservative clarification, timeout controls, duplicate-event protection and transactional persistence.

For voice, open a shipment and select **Talk with Bella**. Review the microphone disclosure, start the conversation, play the carrier, and review the transcript before saving. The agent speaks through ElevenLabs when configured and listens through browser speech recognition. Bella is the initial warm, bright voice; choose another available voice and click **Preview voice** to compare. Browser text-to-speech remains an explicitly selected basic fallback. It asks at most one clarification, targeted to the missing date, time or timezone; voice input explicitly defines IST as India Standard Time (Asia/Kolkata); uncertain answers remain unconfirmed. No phone calls are placed.

Speech recognition support varies: if the embedded browser does not support it, use Chrome at the same localhost URL. [Browser speech recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) may send audio to a browser-operated speech service and may require internet access. Reviewed transcript text and its provenance are stored after confirmation. Optional audio recording is off by default and needs separate consent for each conversation; see the audio-history section below. Microphone access starts only after opt-in and a user action. A clearly labelled typed fallback is available. This is a guided, rule-based conversation, not open-ended LLM reasoning.

### Natural voice setup

Create an ElevenLabs account, then open **Developers → API Keys**. Create a key with Text to Speech and Voices read permissions. Copy the full secret shown at creation, not the key ID. Add `ELEVENLABS_API_KEY=your_secret` to the ignored `.env`, then restart the server. See the [official key instructions](https://elevenlabs.io/docs/help-center/technical/how-do-i-authorize-myself-using-an-api-key).

The server uses `eleven_multilingual_v2` with short, whole-utterance prompts. It sends only allowlisted generic agent prompts; shipment details and carrier transcripts are not sent to ElevenLabs. The key stays on the server. Generated prompt clips are cached in memory, with request limits and timeouts. Previewing new voices and generating new prompts consume ElevenLabs credits. No account or paid subscription is created by the app. Provider errors never silently switch to a system voice.

The demo recognizes bounded intents for ETA updates, delays, human requests, frustration, wrong numbers and refusals. Frustration receives an empathetic response. Delays and explicit human requests offer human help; an accepted offer plays a clearly labelled hold-music preview and opens an interactive coordinator path. The user switches to the coordinator desk, explicitly joins, and exchanges practice replies with the caller screen. Both roles are played locally by the user; no external person or phone transfer joins. Replies and the handoff status are persisted only after review and save. Caller-facing speech never mentions transcripts or backend processing.

Read the [walkthrough](docs/WALKTHROUGH.md) and [validation report](validation/REPORT.md).

## Supabase connection

The app can use a **dedicated** Supabase project. Connecting a GitHub repository in Supabase does not by itself host this React/Node application or configure its server secrets.

1. Apply the SQL files in `supabase/migrations/` in filename order to your dedicated project, once. The initial owner’s project already has both migrations and eight seed shipments; do not reapply them there.
2. In your ignored local `.env`, set:

```dotenv
DATA_MODE=supabase
PORT=4173
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

The server key stays in Node. Never prefix it with `VITE_`, commit it, or paste it into chat. `.env` is ignored. The publishable key is intentionally available to the browser for Supabase Auth.

3. Have the reviewer create their own account from the app (or create a demo user in Supabase Authentication). Copy that user's UUID, then run this SQL in your project (replace the placeholder):

```sql
insert into shipment_demo.members(user_id, role)
values ('REPLACE_WITH_AUTH_USER_UUID'::uuid, 'coordinator')
on conflict (user_id) do update set role = excluded.role;
```

Use `viewer` for read-only access. The app verifies the bearer token with Supabase Auth and checks membership on every API request. An unassigned account is denied access.

4. Restart `npm run dev`, then sign in. The server enforces the configured storage mode; technical connection details are kept out of the customer-facing sidebar. The hosted adapter seeds an empty snapshot on first start; it does not overwrite an existing one. Hosted reset is intentionally unavailable.

## Architecture and boundaries

React/Vite frontend → localhost-only Express server → either PGlite or Supabase PostgreSQL. Shared TypeScript domain logic interprets scripted statements and computes state. The hosted server calls three service-only RPCs; browser database access is revoked, and all 12 tables have RLS. The private schema stores a versioned snapshot and linked projections in one transaction with append-only history checks. This deliberately favors a small demo; it is not a high-volume production architecture.

Supabase can report “RLS enabled, no policy” for these tables: this is intentional default-deny browser access; authorization is enforced by the Node server. See [Supabase's advisory explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Database administrators and the server's privileged key remain trusted; history is not tamper-proof against administrators.

The first hosted inspection also reported public execution permissions on Supabase's pre-existing `public.rls_auto_enable()` helper. That helper was not created or altered by this app. Review [anonymous execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [authenticated execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) before any wider use. The second migration adds the missing report-attempt and shipment-contact indexes. Security-invoker views expose company settings, individual escalation reasons and escalation events to the server role only. Leaked-password protection is disabled in the current project; review [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) before wider use.

No real calls, LLM, SMS/WhatsApp, carrier negotiation, receiving-site calls, TMS integration, deployment or production-readiness claim. Shipment entry now supports labelled dictation with editable extracted fields and an explicit review gate. Unclear carriers, dates and zones are left for manual completion. This bounded parser does not claim general voice-to-record understanding. The ETA conversation also requires transcript review before save. Dates and timeout progression use the explicit simulation clock, not wall time. Advancing the clock closes all overdue attempts as dropped, timed-out calls. The read-only company configuration defaults to 120 seconds; `seed({timeoutSeconds: 30})` configures a different 1–3600 second limit for a fresh fixture. Existing snapshots retain their configured limit. The parser supports documented date/time patterns and a bounded set of spoken numbers/ordinals. It does not understand arbitrary carrier speech; unsupported or tentative answers remain unconfirmed.

## Verify

Chrome is required for the browser suite. Tests launch their own local server on port 4180, with `.data/browser-tests` and a distinct development WebSocket port. They refuse server reuse and assert local mode before resetting fictional test data. The working Supabase app on port 4173 is unaffected. Voice browser tests use speech API doubles; they do not validate real microphone, transcription, or playback quality.

```sh
npm test
npm run test:browser
npm run eval
npm run report
npm run lint
npm run build
```

`lint` currently runs strict TypeScript static checks, not an ESLint style ruleset. See [DeepEval setup and evidence boundaries](evals/README.md), [conversation evals](validation/CONVERSATION-EVALS.md), [transcript evals](validation/EVALS.md) and the [real audio protocol](evals/AUDIO-CHECKS.md).

The report separates scenario scoring from lifecycle, database and browser tests. Raw local test output is ignored because it may include machine paths. Server-to-Supabase reads and coordinator membership were verified after credential configuration. An authenticated hosted voice save and a real microphone trial remain separate user checks.

`npm run build` creates `dist`; `npm start` serves it on localhost. Deployment and live-provider work require separate configuration and authorization.

## Reviewer accounts

The sign-in screen includes **Create an account**. Reviewers use their own credentials and confirm their email when required. Signing up does not grant access: the owner must add the verified Auth user ID to `shipment_demo.members` with the intended role. Never assign access from user-editable profile metadata. Server authorization validates the session and looks up membership on each request. Authorized members share the same Regenesys records; this is one company, not separate per-person data silos. Viewers cannot mutate records or generate speech.

Purva has not yet completed the actual signup, membership assignment and signed-in save/refresh trial. Automated Auth UI responses and authorization checks are controlled tests, not proof that her live account is configured. The app still binds to localhost; GitHub is source hosting, not a remotely accessible application. Public deployment remains separate work.

## Optional audio history

The owner approved per-conversation consent and seven-day retention. `AUDIO_HISTORY_ENABLED=true` enables the feature only after storage is ready. In hosted mode, run `node --import tsx scripts/setup-audio.ts` with private server credentials to create the private `shipment-demo-audio` bucket (10 MB maximum; WebM, MP4 or Ogg). No anonymous/authenticated Storage policies are added. In local mode, files live in an ignored directory beside the local database with restricted filesystem permissions.

Before starting, the user separately checks the recording consent box. A visible indicator and stop/discard controls remain available. Browser recordings are limited to five minutes. ElevenLabs playback can be mixed with the microphone; browser-TTS fallback captures the microphone only. Hold music and typed coordinator replies are not included. Shipment dictation is not recorded. Only a reviewed, saved browser-voice conversation can receive an audio attachment, and only its creator can attach it. Authorized workspace members can fetch playback through the authenticated Node API; there are no public or signed playback URLs. Recording metadata and consent are preserved in Activity. Audio bytes never enter the public repository.

Playback access expires seven days after upload using real time, independent of the practice clock. Cleanup runs at server startup and hourly while this local server is running. If the machine/server is offline, physical deletion waits for the next successful cleanup; an always-on hosted cleanup job is still needed for strict deletion timing. Existing copies downloaded by a user are outside this retention mechanism. Unlinked failed uploads are cleaned after one hour. Failed upload does not erase the reviewed conversation; the UI says the conversation saved and offers retry or audio discard.

Verified: synthetic browser microphone recording, save and playback after refresh; local SQL metadata persistence; seven-day expiry and physical cleanup tests; hosted service upload/download byte roundtrip; anonymous Storage download and direct database read denial. The hosted test object was removed. A real microphone/Bella mixed-audio recording on the user's device and a complete signed-in hosted audio save remain pending.

The header **Ask** button opens searchable written guides; it does not claim live or generative support. **What's new** explains shipped demo features. Company shows the fictional carrier directory and team workflow, while Activity preserves actions and displays current issue status separately.

For email confirmation, configure the app origin in Supabase Auth URL Configuration before inviting a reviewer. The current local origin is `http://127.0.0.1:4173`; a future deployment needs its actual public URL. The hosted signup/confirmation redirect settings have not been verified in this session.
