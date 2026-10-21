# BrianE-Dev

BrianE-Dev is an educational technology platform for developer productivity, software engineering, and practical AI-assisted development workflows. The flagship course, **AI-Powered Developer Productivity for Software Engineers**, teaches ways to apply AI across planning, implementation, debugging, testing, documentation, and delivery.

**Ownership:** BrianE-Dev and this project are the property of Chukwuemeka Nkama. The codebase and brand are proprietary, subject to the licenses of third-party components and assets. No open-source license is granted by this notice.

- Production website: <https://briane-dev.online>
- Privacy Policy: <https://briane-dev.online/privacy>
- Course overview: <https://briane-dev.online/course/ai-powered-developer-productivity>

## Stack and features

- React 19, Vite 8, JavaScript, and CSS frontend
- Express 5 API, Node.js, MongoDB, and Mongoose
- Paystack checkout with backend-side payment verification and signed webhook handling
- Learner accounts, email verification, protected lessons, course progress, assessments, and required exercise acknowledgements
- Course narration generation and playback, persistent S3-compatible production object storage, and protected course ebook
- Eligibility-checked certificate creation, download, and public verification
- Business enquiry and quote request pages with opt-in marketing consent

The approved course curriculum is maintained in [`src/data/curriculum.js`](src/data/curriculum.js). It currently contains 8 sections and 43 chapters. Lesson content is authored under `content/lessons/`, with validation contracts under `src/data/schemas/` and `src/data/validation/`.

## Repository map

```text
backend/       Express API, models, routes, services, config, backend guide
content/       Authored lessons and protected ebook source/output
public/        Brand assets, social preview, robots.txt, sitemap.xml
scripts/       Course validation and ebook generation
src/           React app, components, curriculum, services, styles
tests/         Node test suite
index.html     Vite HTML shell and default homepage metadata
render.yaml    Render API service blueprint
vercel.json    Vercel frontend build, API proxy, headers, and SPA fallback
```

## Requirements and local setup

Use Node.js 22 or later (Vite 8 requires a current Node release) and npm. Install dependencies from the repository root:

```sh
npm ci
```

The frontend alone can run with `npm run dev`. To use the commerce and learning API, configure the backend environment and run the API with the Vite server:

```sh
npm run dev:all
```

The backend loads `backend/.env`; copy [`backend/.env.example`](backend/.env.example) to that ignored file. The root `.env.example` currently only shows the Vite API URL example and is not the backend configuration source. Set a reachable `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, `CLIENT_URL`, Paystack test keys, and the appropriate local `NODE_ENV` / `APP_ENV`. Keep `.env` files untracked. Never place private keys in Vite `VITE_*` variables or commit secrets. Production secrets belong in the deployment provider's secure runtime configuration.

MongoDB must be reachable before using database-backed API features. The API startup checks configuration and connects to MongoDB; set up the intended database and access restrictions before running the seed command. `npm run seed` upserts the course and initial pricing records; inspect the target database and seed implementation before running it against a shared or production database. It does not overwrite existing pricing. Temporary `SEED_ADMIN_*` values are optional and should only be used through the documented trusted setup process.

See [`backend/README.md`](backend/README.md) for the complete backend variable reference, database setup, payment flow, access rules, TTS and storage architecture, admin setup, and deployment operations.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite frontend |
| `npm run dev:all` | Start the Vite frontend and watched API |
| `npm run server:dev` | Start the watched API only |
| `npm run server:start` | Start the API |
| `npm run build` | Build the Vite app into `dist/` |
| `npm run preview` | Serve the local production build for review |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Node test suite |
| `npm run validate:curriculum` | Validate curriculum and authored lesson content |
| `npm run validate:content:complete` | Require complete lesson content while validating |
| `npm run ebook:build` | Generate the course ebook (requires Chrome, Edge, or Chromium) |
| `npm run seed` | Upsert course and pricing setup data in the configured database |

## Payments, course access, and certificates

Paystack receives checkout requests. The backend selects the active course and configured regional price, creates a payment record, validates Paystack responses against that record, and handles callbacks and signed webhooks. New purchases currently use the configured Nigeria / NGN pricing. Configure test credentials first; the backend keeps provider credentials server-side. Browser code does not decide the payable amount.

The Chapter 1 preview is public. Full lessons, assessments, progress, ebook access, and certificate eligibility require verified paid course access. Certificate completion is evaluated by the backend from course progress and required learning tasks; the current canonical curriculum has 43 chapters. Do not use preview UI or public course metadata to grant access or represent a learner as completed.

New learner registration requires a matching successful purchase and email verification. Password recovery and verification email use the API's server-side SMTP transport. Configure the values documented in [`backend/.env.example`](backend/.env.example) in the API runtime environment; do not put them in Vercel or other frontend build variables. The CRM stores contact/quote requests before attempting email, and provides a safe admin retry path. SMTP acceptance is not proof of inbox delivery. Marketing campaigns are draft-only until unsubscribe, suppression, and delivery-event handling are implemented.

Course audio generation can send lesson text to Google Gemini when the server-side TTS feature is configured. Production audio is stored in persistent S3-compatible storage (Cloudflare R2 is described in current operations documentation); MongoDB stores audio metadata. Local storage is intended for development only. Never expose the Gemini key in frontend configuration.

## Deployment

The checked-in architecture separates a static Vite frontend on Vercel from an Express API on Render. Vercel builds the repository root to `dist/`, forwards `/api/*` to the Render service configured in `vercel.json`, and rewrites application paths to the SPA shell. Render runs `npm run server:start` and connects to MongoDB. The API uses `CLIENT_URL` for allowed origins and deployed cookie behavior. Confirm the Render service hostname, Vercel project URL, database, Paystack mode, and secrets in the provider dashboards before deployment. See the backend guide for the full deployment checklist. Do not put MongoDB, JWT, Paystack secret, or Gemini credentials in Vercel frontend variables.

## Search indexing and SEO

The app provides canonical page metadata, Open Graph and X/Twitter cards, a static social image, `public/robots.txt`, `public/sitemap.xml`, and Organization, WebSite, and Course JSON-LD on public pages. The sitemap lists the homepage, public course overview, services, and privacy page only. Private learner and admin paths and protected course lessons are excluded. Static Vercel assets are served before the SPA fallback.

To submit the site to Google Search:

1. Open [Google Search Console](https://search.google.com/search-console/).
2. Add `briane-dev.online` as a **Domain** property.
3. Copy the TXT verification value Search Console provides and add it to the domain's DNS records with the DNS provider. Wait for DNS propagation, then verify in Search Console.
4. In the property, open **Sitemaps** and submit `https://briane-dev.online/sitemap.xml`.
5. Use **URL Inspection** for `https://briane-dev.online/` and request indexing when appropriate.
6. Review indexing status, crawl errors, Google's selected canonical, and search performance over time.

This repository does not assert that Search Console verification or indexing has occurred. Crawling, indexing, and result updates are controlled by search engines and may take time. HTML-tag or file verification is also possible if preferred, but DNS TXT verification avoids putting a verification token in source control.

## Privacy and security

The public [`Privacy Policy`](https://briane-dev.online/privacy) describes account, course, progress, payment-reference, certificate, enquiry, session-cookie, and configured provider data flows. Paystack processes payment details; the app stores references and transaction state, not full card details. The policy provides `info@briane-dev.online` as a contact route for privacy requests. No automatic deletion flow or fixed retention schedule is represented as available.

Use HTTPS and provider-managed secret storage in production. Keep JWT, Paystack secret, Gemini, SMTP, database, and object-storage credentials server-side. Do not grant admin roles through public registration. Protect MongoDB access, validate payment callbacks and webhooks, and avoid logging private credentials or personal learner data.

## Troubleshooting

- API startup fails: check required `JWT_SECRET`, Paystack configuration, `PORT`, MongoDB reachability, Atlas network access, and backend environment file location.
- Frontend requests fail locally: run `npm run dev:all` and confirm the Vite API URL in the root `.env` configuration.
- Payment does not grant access: verify the payment in Paystack and confirm the API's test/live mode, webhook URL, configured course price, and matching checkout email.
- Production narration is unavailable: check the backend Gemini configuration and production S3-compatible storage settings; production intentionally requires persistent audio storage.
- Deep link reload fails: confirm Vercel is using the repository `vercel.json` and publishing the root Vite build output.

## Contribution and licensing

Keep the canonical curriculum and stable course IDs in `src/data/curriculum.js`. Validate content changes with `npm run validate:curriculum`; use the existing scripts for build, lint, and tests. Keep changes focused and preserve API contracts, payment verification, access restrictions, and certificate checks.

No `LICENSE` file is present in this repository. BrianE-Dev code and brand are proprietary to Chukwuemeka Nkama, subject to applicable third-party component and asset licenses. This README does not grant an open-source license or override third-party licenses.
