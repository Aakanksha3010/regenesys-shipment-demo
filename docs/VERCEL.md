# Vercel deployment

The repository root is the app root. Vercel builds the Vite frontend into `dist` and routes `/api/*` to `api/index.ts`. The API uses the existing Supabase project; local simulated identity is rejected on Vercel. Keep the project on its current plan; no paid upgrade is required for this deployment configuration.

## Production settings

Use the Vite preset, `npm run build`, output `dist`, and Node.js 24.x. Connect `Aakanksha3010/regenesys-shipment-demo`, production branch `main`, so later pushes create deployments. Do not upload `.env`, `.data`, recordings, or test results.

Set these **server-only Production environment variables** from the existing local configuration:

- `DATA_MODE=supabase` (optional on Vercel, which always requires Supabase; explicitly selecting local mode is rejected)
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (only this public key is returned to the client)
- `SUPABASE_SECRET_KEY`
- `ELEVENLABS_API_KEY`
- `AUDIO_HISTORY_ENABLED=true` when the private recording bucket is available
- `APP_ORIGIN` equal to the assigned production HTTPS origin

Never prefix server secrets with `VITE_`. Do not enable these secrets for arbitrary fork/preview deployments. Vercel's generated exact deployment origin is also accepted; arbitrary `*.vercel.app` origins are not.

In the dedicated Supabase project's Auth URL settings, set Site URL to the verified production origin and add that exact redirect URL. Preserve the existing local redirect entries. Apply `private_account_workspaces` before deploying the private-account server. Confirmed accounts receive private workspaces. The migration preserves legacy shared history only for the original owner and disables the old global RPCs (the old deployment will fail closed until updated). Unconfirmed/anonymous accounts remain excluded; existing viewer roles are preserved.

## Verification before sharing

1. Production HTML and asset requests return 200 and render the sign-in screen.
2. `/api/config` returns Supabase mode, public configuration and audio availability, without server secrets.
3. Unsigned `/api/state`, voice and recording access returns 401. An untrusted Origin returns 403.
4. Sign in normally, verify shipments, make a reviewed fictional update and confirm it survives reload.
5. Test signup/email confirmation, automatic confirmed membership, Bella, microphone replies and consented recording playback on the deployed origin. Browser permissions are specific to the new site.

## Recording and cleanup limitations

Recording uploads are limited to 4 MB, below Vercel's 4.5 MB function payload limit. The browser stops capture at five minutes or approximately 3.5 MB; it refuses an oversized final blob while allowing the user to discard audio and retain the conversation.

Playback expires after seven days. The deployed API performs overdue cleanup during authenticated requests, at most hourly per warm instance. It does not rely on a background timer surviving serverless shutdown. **Physical deletion during periods with no requests still needs a separately configured scheduled cleanup job.** Do not claim strict offline deletion until that job is installed and verified.

References: [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js), [function payload limits](https://vercel.com/docs/functions/limitations), [Supabase Auth redirects](https://supabase.com/docs/guides/auth/redirect-urls).
