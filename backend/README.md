# BrianE-Dev API

Node.js, Express, Mongoose REST API for persistent course commerce and learning progress.

## Setup

1. Install project packages with `npm install`.
2. Copy `backend/.env.example` to `backend/.env` and configure MongoDB, `CLIENT_URL`, a random 32+ character `JWT_SECRET`, and the existing DevPortix Paystack TEST credentials. Keep all credentials server-side. The Paystack public key is required in backend configuration but is not needed by the current authorization-URL checkout and is never returned to React.
3. Set `MONGODB_URI` to a reachable local MongoDB URI or Atlas `mongodb+srv://...` URI. The example leaves it blank intentionally. Configure Atlas network access and the database user before seeding.
4. Run `npm run seed` to upsert the published course and initial regional prices.
5. Run `npm run dev:all` from the root to start Vite and the API, or `npm run server:start` for the API alone.

Both the API and seed load `backend/.env` by its file location, regardless of the current working directory. The API validates Paystack configuration and connects to MongoDB before listening; startup fails with an actionable error if either configuration or MongoDB is invalid/unavailable. Logs never include credential values or the MongoDB URI. The seed command does not require Paystack credentials, disconnects in a `finally` block, and reports the seeded course section/chapter counts and regional pricing count on success. A MongoDB connection is required to verify seed persistence; frontend build/lint checks alone do not establish that database contents were written.

Seed prices are configurable setup defaults: Nigeria is independently set to NGN 15,000 with a 40% discount (NGN 9,000). The old INTL/USD record is retained for historical administration only; new course purchases use only the NG/NGN record. These are setup defaults and do not overwrite existing MongoDB pricing. The Nigerian value is not exchange-rate-derived. Discounts and dates are calculated by the API; React only displays the returned amount. Edit the Nigerian configuration in the admin panel after creating an administrator.

## Super Admin

There is no default or publicly accessible admin account. To create one for development, set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (use a unique strong password), and optionally `SEED_ADMIN_NAME` in `backend/.env`, run `npm run seed`, then remove those variables. Registration always assigns the `user` role. Admin APIs check the persisted role. Use the React `/super-admin` page to sign in; only a persisted `super_admin` account can open `/admin`, the commerce dashboard. Configure production static hosting to route these paths to the React app entry point.

## Paystack

Paystack is currently the only provider. New course purchases are available only to customers in Nigeria and use NGN. Registration is free and grants preview access; full-course access depends on successful server-side Paystack verification. The server loads the authoritative amount from MongoDB pricing, verifies Paystack transactions before marking local payments paid, and validates webhook signatures against the raw request body before re-verifying transactions with Paystack.

Use the existing DevPortix Paystack business and its credentials; BrianE-Dev does not require a separate Paystack business. Select environment through `APP_ENV=development` (TEST keys) or `APP_ENV=production` (LIVE keys). No credentials are hard-coded. On startup, the backend requires `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, and `PAYSTACK_BASE_URL`. Known `pk_test_`/`sk_test_` and `pk_live_`/`sk_live_` prefixes are checked against `APP_ENV`; unknown future key formats are not rejected solely by prefix. `PAYSTACK_BASE_URL` must be `https://api.paystack.co` for either environment. Error messages identify variable names but never print key or secret values.

Every BrianE-Dev transaction has a unique `BDE-YYYYMMDD-RANDOM` reference, `application: brianedev` metadata, product/pricing/user/region/environment identifiers, and Paystack custom fields. Payment records retain `provider: paystack` and `environment`; payment lookup, admin views, and course access are scoped to the active environment so TEST transactions cannot grant LIVE course access. Set the Paystack webhook URL to `https://YOUR_API_HOST/api/brianedev/payments/paystack/webhook`. HMAC validation uses `PAYSTACK_WEBHOOK_SECRET`; use the corresponding TEST webhook secret in development and LIVE webhook secret in production. The webhook re-verifies the transaction with Paystack before confirming it. Checkout uses a server-created authorization URL. The public key is never sent to React because the current flow does not need it. The callback URL is only a return path: access is granted only after authenticated server-side verification or the signed webhook.

Local TEST setup in `backend/.env`:

```env
APP_ENV=development
PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_WEBHOOK_SECRET=<test-webhook-secret>
PAYSTACK_BASE_URL=https://api.paystack.co
```

Start local services with `npm run seed` (MongoDB must be reachable) and `npm run dev:all`. Use Paystack TEST checkout and a TEST webhook configured to reach the local API through your approved tunnel. Do not use real financial transactions during development.

Production deployment should set `APP_ENV=production`, `NODE_ENV=production`, production `MONGODB_URI`, `CLIENT_URL`, `JWT_SECRET`, `PAYSTACK_PUBLIC_KEY=pk_live_...`, `PAYSTACK_SECRET_KEY=sk_live_...`, `PAYSTACK_WEBHOOK_SECRET=<live-webhook-secret>`, `PAYSTACK_BASE_URL=https://api.paystack.co`, and `PORT`. Replace credentials and webhook configuration in the deployment secret manager; no controller, model, service, or React changes are required for the environment switch. Run approved production smoke checks without embedding secrets in source or frontend configuration.

## API

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/pricing` (returns the authoritative Nigeria/NGN price for all visitors; new purchases are Nigerian-only)
- `GET /api/courses`, `GET /api/courses/:slug` (public course and canonical curriculum metadata only)
- `POST /api/brianedev/payments/initialize` (authenticated; course and amount are selected server-side), `POST /api/brianedev/payments/verify` with `{ "reference": "BDE-..." }`, `POST /api/brianedev/payments/paystack/webhook` (compatibility aliases remain under `/api/payments/*`)
- `GET /api/me/purchases`, `GET /api/me/progress/:courseId`, `GET /api/me/certificates`
- `GET /api/courses/:courseId/progress` (stable curriculum chapter progress; requires authentication and paid purchase)
- `GET /api/courses/:slug/lessons/chapter-ai-assisted-developer/preview` (public, deterministic Chapter 1 preview only; no progress, exercise, TTS, or assessment payload)
- `GET /api/courses/:courseId/lessons/:chapterId` (requires a verified purchase; unpaid and anonymous callers receive `403 COURSE_PURCHASE_REQUIRED`; preserves `course` and `lesson` and adds chapter navigation, progress, and access metadata)
- `GET /api/courses/:courseId/lessons/:chapterId/audio/status` and `GET /api/courses/:courseId/lessons/:chapterId/audio` (authenticated; paid learners and Super Admins only; stored audio playback never generates audio)
- `POST /api/courses/:courseId/lessons/:chapterId/progress` with `{ "status": "in_progress" | "completed" }`
- `POST /api/courses/:courseId/lessons/:chapterId/exercises/:exerciseId/complete` (records learner acknowledgment for required exercises)
- `POST /api/courses/:courseId/lessons/:chapterId/assessment` with `{ "answers": [{ "questionId": "assessment-id", "optionId": "option-id" }] }`
- `GET /api/courses/:courseId/lessons/:chapterId/assets?src=content/...` (authenticated protected lesson images only)
- `POST /api/courses/:courseId/progress/:chapterId` (legacy path; now accepts stable chapter IDs and applies the same completion evaluator)
- `GET /api/me/certificates` (requires authentication and a paid purchase; returns certificates only after canonical completion)
- `GET /api/me/certificates/:certificateId/download` (requires the certificate owner, paid course access, and all canonical completion requirements; returns a PDF)
- `GET /api/certificates/verify/:certificateId` (public validity check; returns certificate ID, learner name, course title, and issue date only)
- `GET /api/courses/:courseId/ebook/status` (public ebook title and availability only)
- `GET /api/courses/:courseId/ebook` (download; requires a verified purchase; serves `content/ebooks/briane-dev-course.pdf`)
- Super Admin: `GET /api/admin/pricing`, `PUT /api/admin/pricing/:region`, `GET /api/admin/transactions`, `GET /api/admin/purchases`, `GET /api/admin/certificates`
- Super Admin TTS: `GET /api/admin/tts/courses/:courseId/status`, `POST /api/admin/tts/courses/:courseId/generate-missing`, `POST /api/admin/tts/courses/:courseId/chapters/:chapterId/generate`

Authentication uses an HTTP-only, same-site cookie. Production must use HTTPS. Configure the exact frontend origin in `CLIENT_URL`; multiple origins may be comma-separated. Sensitive routes have rate limits and request validation. Payments are immutable through the admin API. Pricing writes create audit records. Mongoose uses unique indexes for emails, course slugs, pricing regions, payment references, Paystack references, and certificate IDs; compound indexes support environment-isolated payment administration and one-progress/one-certificate-per-user/course lookups.

## Lesson content and delivery

`src/data/curriculum.js` remains the canonical curriculum metadata source. All 43 authored lesson JSON files live in `content/lessons/<chapterId>.json`; MongoDB continues to hold course commerce and learner/application state, not authored lesson bodies. `backend/src/services/lessonRepository.js` resolves the stable `chapterId`, reads that exact filename, and runs the Zod and curriculum/title/filename checks before returning content. `npm run validate:content:complete` requires all 43 canonical lessons.

The public preview route is limited to Chapter 1 and uses that lesson's explicit stable block ID allowlist. It returns only those blocks and omits objectives, narration, exercises, assessments, answers, and progress. The full lesson route requires a paid BrianE-Dev purchase in the active Paystack environment for ordinary learners; authenticated Super Admins bypass this learner purchase restriction. Anonymous and authenticated unpaid learners receive a machine-readable purchase-required denial with no lesson body. It strips answer keys and explanations before returning learner lesson content. Assessment submissions are scored on the server; attempts store selected option, outcome, score, and stable content identifiers but never answer keys. Learners receive only aggregate score and pass status.

The existing `CourseProgress` document has additive stable-ID chapter state (`chapterProgress`), `currentChapterId`, and separate canonical completion fields. Existing legacy fields remain in place and are not translated from array indexes. Required exercises are completed by an explicit learner acknowledgment stored by exercise ID. Course completion requires all canonical chapters complete and all required activities satisfied; a certificate is created once when the course is certificate-eligible. Assessment retries are unlimited and recorded with a unique per-assessment attempt number.

The React learner experience is available at `/learn/login`, `/learn/register`, `/learn`, and `/courses/:courseSlug/learn/:chapterId`. Registration creates a free account and never creates a payment or course entitlement. The reader attempts paid delivery and falls back to the public server-filtered Chapter 1 preview only when access is denied; other unpaid chapters display a purchase gate. Preview reading creates no progress. Lesson images are served only to purchasers, only when their exact path is referenced by that validated lesson, and only when they resolve inside `content/`. The dashboard distinguishes preview-only accounts from paid learners and shows stable-ID progress, ebook access, and issued certificate actions. Ebook downloads are served from `content/ebooks/briane-dev-course.pdf` only after a verified purchase check. Browser speech synthesis is optional and does not affect progress. Certificate download requires authentication, ownership, paid access, and canonical completion; the verification endpoint is public and returns only intended certificate details.

## Super Admin course access and generated narration

The persisted `super_admin` role is checked server-side. Super Admins can request any published BrianE-Dev lesson and chapter without a purchase record, and chapter navigation does not depend on learner progress or assessment completion. The reader marks this access as privileged and does not create learner progress simply by opening a lesson. Ordinary learner purchase, progress, and assessment rules remain in force. Admin APIs, including narration generation, require an authenticated Super Admin session.

The learner reader uses stored chapter narration when available. It does not call Gemini on playback. An authenticated paid learner or Super Admin can request `GET /api/courses/:courseId/lessons/:chapterId/audio`; if narration has not been generated, the API returns `404 AUDIO_NOT_GENERATED`. The matching `/audio/status` endpoint reports availability without downloading audio. The free Chapter 1 preview continues to use browser speech synthesis.

### Gemini configuration

Set these variables only in the backend environment (for production, the backend service's secret/environment settings). Never create `VITE_GEMINI_API_KEY` or put a Gemini key in Vercel/frontend variables.

```env
GEMINI_API_KEY=<server-only API key>
GEMINI_TTS_MODEL=gemini-3.8-flash-lite-tts
GEMINI_TTS_VOICE=Kore
GEMINI_TTS_LANGUAGE=en-US
```

The model, voice, and language are part of the narration cache identity. The default model is Gemini 3.8 Flash-Lite TTS. It accepts text-only input and returns WAV audio; lesson text is sent in deterministic logical chunks below the model's input limit. Code blocks are represented by short contextual narration rather than spoken verbatim, and assessment answer keys and internal IDs are excluded. See Google's [Gemini speech generation guide](https://ai.google.dev/gemini-api/docs/speech-generation) for current model/API details. Requests default to 1,800 characters per chunk with a 15-second pause between chunks; configure `GEMINI_TTS_CHUNK_CHARS` (clamped to 500–3,000) and `GEMINI_TTS_REQUEST_DELAY_MS` in the backend environment to tune these values. HTTP 429 responses are retried up to three times, honoring `Retry-After` when supplied.

### Persistent object storage

Production audio must use persistent S3-compatible object storage; Render's local filesystem is rejected when `NODE_ENV=production`. Audio binaries live in object storage, while MongoDB stores transcript/generation metadata and storage keys. For Amazon S3, set the region, bucket, and access credentials. For Cloudflare R2, create an R2 bucket and S3 API token, then use the account endpoint and the `auto` signing region.

```env
TTS_STORAGE_PROVIDER=s3
TTS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
TTS_S3_BUCKET=
TTS_S3_REGION=auto
TTS_S3_ACCESS_KEY_ID=
TTS_S3_SECRET_ACCESS_KEY=
```

For local development only, `TTS_STORAGE_PROVIDER=local` stores audio under the ignored `backend/.local-tts/` directory. Do not use that provider in production. Object keys include sanitized course/chapter IDs, transcript hash, recording type, and a version ID. Each upload writes a new versioned object, then switches MongoDB metadata to it, so a failed upload leaves the prior ready audio intact.

### Upload manual chapter recordings

In **Super Admin → Course audio**, choose **Record Edge tab audio** beside a chapter, select the browser tab displaying that chapter, and enable tab audio sharing. Switch to the chapter tab, start Edge Read Aloud, then return to Super Admin and choose **Stop and save tab audio**. The recording is uploaded directly to the selected chapter. Browser tab capture requires HTTPS or localhost and a browser that offers tab audio sharing; if capture is unavailable, record externally and upload an MP3, WAV, M4A, AAC, OGG, or WebM file up to 50 MB. The backend stores audio in configured object storage (Cloudflare R2 in production) and saves metadata and the storage key in MongoDB. The learner's existing chapter player streams the recording through the authenticated audio endpoint. Both recording and upload require the authenticated Super Admin session.

### Generate and monitor course audio

Open **Super Admin → Course audio** in `/admin`. **Generate missing audio** produces only chapters with no valid recording; it leaves older valid recordings in place when a chapter has changed. **Regenerate changed audio** creates recordings for missing or stale chapters whose lesson version, transcript hash, model, voice, or language differs. Generation is sequential and uses a persisted MongoDB batch job. If the API process restarts, it resumes the running job and skips successful chapters. Failed chapters are reported and can be retried by starting the appropriate batch again.

The batch API is `POST /api/admin/tts/courses/:courseId/generate-missing` with `{ "mode": "missing" }`, `{ "mode": "changed" }`, or an explicit `{ "mode": "force" }`. Force mode is not the default and intentionally regenerates every chapter. `GET /api/admin/tts/courses/:courseId/status` reports chapter states, batch state, and safe error messages. One chapter can be generated with `POST /api/admin/tts/courses/:courseId/chapters/:chapterId/generate`; its optional `{ "force": true }` body explicitly regenerates that chapter.

Cache identity includes course, stable chapter ID, lesson content version, normalized transcript SHA-256, Gemini model, voice, and language. Identical inputs with audio present are a cache hit and do not call Gemini. Changed inputs are stale and are regenerated in `changed` mode. Playback endpoints only read stored audio and never call Gemini. Generation endpoints have rate limits and Super Admin authorization; the Gemini key is never returned or logged.

Run `npm run ebook:build` to regenerate the protected ebook from the canonical curriculum and lesson JSON. The build script requires an installed Chrome/Edge/Chromium executable; set `PDF_BROWSER` to override automatic discovery. No backend runtime PDF dependency or new database model is required.

## Payment and completion rules

The browser submits a product ID only; it cannot submit amount, currency, region, or discount. The backend selects the course and regional MongoDB price, computes the discount and final amount, generates a `BDE-YYYYMMDD-RANDOM` reference, and writes a pending payment snapshot before calling Paystack. The payment snapshot stores application/product identity, user/course, Paystack reference, pricing record ID, region, original/final amounts, discount details, and currency. Paystack receives corresponding application/product/user/region/pricing metadata and dashboard custom fields.

After checkout, the React return handler sends the reference to `/api/brianedev/payments/verify`. That endpoint requires the authenticated owner and verifies the reference directly with Paystack. The signed webhook at `/api/brianedev/payments/paystack/webhook` independently verifies the transaction. Both paths compare the payment record's application, product, reference, amount in minor units, and currency before setting `paid`. Unique references and conditional state changes make duplicate webhook deliveries idempotent. Only `paid` (plus the legacy `successful` state for older records) BrianE-Dev payments grant access. Canonical progress tracks stable chapter IDs. Certificate creation requires all 43 stable chapters complete, required assessments passed, required exercises acknowledged, and a certificate-eligible course.

## Production checklist

- Use managed MongoDB with network restrictions and backups.
- Set production-only random secrets, HTTPS, exact CORS origins, and Paystack live keys in the deployment secret manager.
- Deploy the API separately from the static React frontend; set `VITE_API_URL` at frontend build time.
- Set Paystack's webhook URL to the deployed API endpoint.
- Run the seed command once against the intended database; avoid development seed credentials in production.
- Promote the first Super Admin through a trusted database/operations process. Never add admin role assignment to public registration.
- Country headers do not select purchase currency or price; all new course purchases use the configured Nigeria/NGN price.

## Vercel + Render deployment

The repository includes a Vercel config for the React app and a Render Blueprint for the API. Import the repository into Vercel with the repository root as the project root. Vercel uses `npm run build`, outputs `dist`, forwards `/api/*` to `https://briane-dev-api.onrender.com/api/*`, and rewrites other paths to the SPA entry point. The API client defaults to `/api` in production, so browser requests and HTTP-only cookies remain same-origin. If you rename the Render service, update the destination in `vercel.json` to match its `onrender.com` hostname.

Create the Render service from `render.yaml`. It runs `npm ci --omit=dev`, `npm run server:start`, and uses `/api/health` as its health check. It binds to Render's `PORT` on `0.0.0.0`. The blueprint begins with `APP_ENV=development` (Paystack TEST mode) and `NODE_ENV=production` (HTTPS-secure deployed cookies). Enter the requested secret values in Render; do not add them to `render.yaml` or Git.

Set Render variables:

- `CLIENT_URL`: the exact deployed Vercel origin, such as `https://your-project.vercel.app` (comma-separate additional approved origins).
- `MONGODB_URI`: the production/staging Atlas connection URI, and configure Atlas network access for the Render service.
- `JWT_SECRET`: use the Blueprint-generated value.
- `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`: TEST keys for the initial deployment.
- `PAYSTACK_WEBHOOK_SECRET`: use the same TEST Paystack secret key for Paystack's HMAC signature validation; keep it as a separate environment setting so it can be replaced during the LIVE switch.
- `PAYSTACK_BASE_URL`: the blueprint sets `https://api.paystack.co`.

Set `CLIENT_URL` after the Vercel deployment exists, then redeploy the Render API. Set the TEST webhook URL in the Paystack dashboard to `https://briane-dev-api.onrender.com/api/brianedev/payments/paystack/webhook`. Run `npm run seed` from a trusted workstation with `MONGODB_URI` pointed at the intended Atlas database. Do not set `SEED_ADMIN_*` unless intentionally creating the first admin; remove those temporary values after seeding.

In Vercel, keep the project root at the repository root. The checked-in rewrite points at the default Render service name; if it changes, update `vercel.json` and redeploy the frontend. No Paystack or MongoDB secrets belong in Vercel. The only frontend-facing API path is `/api` on the same Vercel origin.

For LIVE mode later, update Render to `APP_ENV=production`, replace both Paystack keys and the webhook secret with their LIVE values, configure the LIVE webhook in Paystack, and confirm the production Atlas URI. The Render service remains on `NODE_ENV=production`; frontend code and payment routes do not need rewriting.

The React project includes the public curriculum overview and authenticated learner dashboard/reader. Lesson bodies remain authored JSON in `content/lessons/`; all 43 canonical lessons have authored content.
