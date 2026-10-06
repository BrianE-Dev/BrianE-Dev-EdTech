# BrianE-Dev Documentation

## Product overview

BrianE-Dev is a React learning application for **AI-powered developer productivity for software engineers**. Its course teaches software developers to use AI effectively throughout the software development lifecycle, including reasoning, planning, code understanding, debugging, refactoring, documentation, testing, architecture, and delivery.

The course is about using AI to improve software development work, not learning programming from scratch. Code is the working context for lessons, examples, demonstrations, and workflows. Learners study the material and apply it in their own development workflows.

## Approved course

**AI-Powered Developer Productivity for Software Engineers**

The canonical curriculum is [`src/data/curriculum.js`](src/data/curriculum.js), version **1.0.0**. It defines the approved 8 sections and 43 chapters, including immutable section/chapter IDs and explicit display ordering. Keep curriculum changes in that source; do not maintain another application curriculum list. The homepage and course metadata consume the exported curriculum.

Lesson content uses the Phase 3 versioned JSON contract. Authored files live under `content/lessons/<chapterId>.json`; the first authored lesson is `chapter-ai-assisted-developer.json`. The backend repository validates schema, chapter identity, canonical title, and filename before returning content. See `src/data/schemas/lessonSchema.js`, `src/data/validation/`, and `backend/src/services/lessonRepository.js`.

Run `npm run validate:curriculum` to check the curriculum and any lesson files that exist. Missing lessons are allowed during incremental authoring. Run `npm run validate:content:complete` to require a valid file for every chapter, and `npm test` for automated curriculum, schema, repository, access, API, and sanitization tests.

## Course content format

The intended course format is written lessons, code examples, real-world development scenarios, AI prompts and workflows, explanations, practical demonstrations, and optional TTS narration. The homepage audio controls are illustrative. The authenticated lesson reader provides optional narration through browser speech synthesis when available.

The application does not currently provide interactive coding sandboxes, browser coding playgrounds, automated coding challenges, lesson checkpoints, quizzes, in-platform coding assignments, or automated skill assessments. Avoid describing these as product features unless they are implemented in a future version.

## Current application

The current frontend is a responsive React 19 application built with Vite. It contains a homepage with:

- Hero section and product positioning
- Feature cards for written lessons and code examples, AI-powered workflows, and planned TTS narration
- Eight expandable curriculum cards with chapter titles
- Course-format overview
- Access-plan cards, FAQs, and navigation anchors
- Light and dark themes; the saved preference is stored in local storage, with the operating-system theme used on first visit
- A hero entrance animation that replays when the hero re-enters the viewport and respects reduced-motion preferences

The React app includes free learner account registration and login at `/learn/register` and `/learn/login`, a learner dashboard at `/learn`, and lesson routes at `/courses/:courseSlug/learn/:chapterId`. Registration creates an account only; it does not create a purchase or course entitlement. Chapter 1 offers a server-filtered public preview, while full lessons, assessments, progress, ebook downloads, and certificate eligibility require a verified purchase through the existing Paystack flow. Super Admin sign-in is at `/login`, with the protected commerce dashboard at `/admin`.

The separate Express/Mongoose API persists users, courses, regional pricing, payments, progress, certificates, and audit records. Authored lesson JSON is validated and read from the repository; MongoDB stores commerce and learner/application state. Full lesson and progress endpoints require a verified purchase in the active Paystack environment. Assessment answers are scored server-side and answer keys are removed from learner responses. Certificate endpoints require the certificate owner, paid access, and completion of the canonical course requirements. See [`backend/README.md`](backend/README.md) for backend setup and API details.

The files in `UI From Stitch/` are design references. Older curriculum descriptions and mock interface elements in those references are not authoritative product content. Use `src/data/curriculum.js` for approved course information.

## Project structure

```text
.
├── public/                 # Static public assets, including favicon and SVG symbols
├── backend/                # Express/Mongoose API, models, routes, services, and seed
├── src/
│   ├── components/         # Shared React UI components
│   ├── data/
│   │   ├── curriculum.js   # Single source of truth for title, sections, chapters, and formats
│   │   └── homepage.js     # Homepage features, FAQs, and access-plan descriptions
│   ├── App.jsx             # Homepage composition and interactions
│   ├── App.css             # Component and responsive styles
│   ├── index.css            # Global styles and theme tokens
│   └── main.jsx             # React application entry point
├── UI From Stitch/         # Supplied design references and imagery
├── DOCUMENTATION.md
├── index.html
├── package.json
└── vite.config.js
```

Shared UI components include `Brand`, `Icon`, `SectionHeading`, `FeatureCard`, `CurriculumCard`, `PricingCard`, and `FaqList` in `src/components/`.

## Development

Requirements: Node.js and npm compatible with the versions declared by the project dependencies.

Install dependencies in the project root:

```sh
npm install
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Create the production build in `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint. |

Runtime dependencies include React, React DOM, and Lucide React for the frontend, plus Express, Mongoose, JWT, password hashing, validation, and security middleware for the backend. Vite, the React plugin, ESLint, and concurrently are development dependencies.

## Backend and commerce

### Local setup

Copy `backend/.env.example` to `backend/.env`, then set `MONGODB_URI`, a random `JWT_SECRET` with at least 32 characters, `CLIENT_URL`, and the server-only Paystack configuration. Install dependencies and initialize the course and prices:

```sh
npm install
npm run seed
npm run dev:all
```

`npm run dev:all` starts the Vite frontend and Express API. `npm run server:dev` starts only the watched API; `npm run server:start` starts the API for production. Set `VITE_API_URL` in the frontend environment when the API is deployed separately.

Set `MONGODB_URI` to a reachable local MongoDB instance or Atlas `mongodb+srv://...` URI; the example leaves it blank. Configure Atlas network access and database credentials outside source control. Both the API and seed load `backend/.env` relative to their source files. The API connects before it accepts requests and fails startup clearly if the connection fails; logs redact the URI. The root `.gitignore` ignores `.env` files, including `backend/.env`.

### Database and initial data

MongoDB is the source of truth for users, the published course structure, pricing, payments, progress, certificates, and audit logs. The seed command upserts the approved course and regional pricing defaults:

- International: USD 15 original price with a 40% promotion (USD 9).
- Nigeria: independently configurable NGN 15,000 original price with a 40% promotion (NGN 9,000). This is not converted from USD.

The seed command does not create a Super Admin unless temporary `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` values are supplied. Remove those values after the development account is created. Public registration always assigns the normal `user` role. Seeding validates the approved 8-section/43-chapter curriculum, upserts by stable course slug and pricing region, preserves the optional admin mechanism, and disconnects from MongoDB even on failure.

### Regional pricing and Paystack

BrianE-Dev uses the existing DevPortix Paystack business and server credentials; it does not need a separate Paystack business. The backend selects Paystack TEST or LIVE configuration using `APP_ENV=development` or `APP_ENV=production`. Required values (`PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_BASE_URL`) are validated at backend startup, and recognized `pk_test_`/`sk_test_` versus `pk_live_`/`sk_live_` prefixes must match that environment. The API base URL is configured as `https://api.paystack.co`. The public key remains backend configuration only because the current checkout uses Paystack's server-created authorization URL. The public React app fetches current prices from `GET /api/pricing`. The backend selects NGN or USD from a saved server-side country or trusted Cloudflare/Vercel edge location headers, with international USD as fallback. Browser-supplied amount, currency, discount, and country values do not determine charges.

Payment initialization uses `POST /api/brianedev/payments/initialize` with the course product ID only. The backend computes the amount and creates a pending record before requesting Paystack checkout. BrianE-Dev references use the unique `BDE-YYYYMMDD-RANDOM` namespace and include `application: brianedev`, course, user, region, currency, pricing record, active environment, and source metadata. Payment records retain `provider: paystack` and `environment`; purchase/access/admin queries are scoped to the active environment to prevent TEST transactions from granting LIVE access. Dashboard custom fields identify BrianE-Dev transactions alongside DevPortix transactions in the shared Paystack account.

After Paystack returns the user, React submits the reference to `POST /api/brianedev/payments/verify`; the authenticated API checks the transaction directly with Paystack. The signed webhook endpoint is `POST /api/brianedev/payments/paystack/webhook`. Both paths validate the saved application/product/payment record, reference, amount in minor currency units, and currency before setting the payment to `paid`. Only confirmed paid records grant course access. Duplicate references are prevented by a unique database index, and payment state updates are idempotent. The callback URL alone does not grant access.

Keep `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `JWT_SECRET`, and `MONGODB_URI` in the backend environment or deployment secret manager. Use TEST keys and a TEST webhook secret for local development; use LIVE keys and the LIVE webhook secret only in production. Never put server secrets in Vite variables or React code, and do not expose the public key unless a future frontend checkout method requires it. Use HTTPS, configure Paystack to send webhooks to the deployed API URL, and configure a trusted edge proxy to overwrite location headers. Full setup, environment variables, and production notes are in [`backend/README.md`](backend/README.md).

Deployment configuration is provided by `vercel.json` and `render.yaml`. Vercel serves the React build, rewrites `/api/*` to Render, and falls back to the app entry point for routes such as `/login` and `/admin`. Render runs the Express API and connects to MongoDB Atlas. The browser calls the same-origin `/api` path, which keeps cookie authentication compatible across the two hosts. Initial Render configuration uses Paystack TEST mode while setting `NODE_ENV=production` for secure HTTPS cookies. Follow [`backend/README.md`](backend/README.md) for Vercel/Render environment setup and the later LIVE switch.

### Learner access, progress, and certificates

Paid purchase records control full lesson and progress API access. Lesson delivery resolves a stable `chapterId` to `content/lessons/<chapterId>.json`, validates it against the schema and canonical curriculum, and removes assessment answer keys and explanations before returning it. The public Chapter 1 preview is selected by stable block IDs and is delivered without progress or paid activities. Public course endpoints expose catalog metadata only. The current authored set is incremental; `npm run validate:content:complete` checks readiness for all 43 lessons. Chapter progress, required exercise acknowledgments, and assessment attempts are stored server-side. Course completion and certificate issuance are evaluated server-side; certificate data is available only to its owner with paid access after canonical completion. The learner dashboard shows course progress, ebook availability, and available certificates, while the lesson reader provides chapter navigation and learning activities.

### Admin commerce

Super Admin sign-in is available at `/login`, and the protected dashboard is at `/admin`. The dashboard shows transaction/payment/certificate counts and includes the commerce panel for pricing changes, transactions, purchases, and issued certificates. Accounts are created through the seed/admin setup; public registration does not grant admin privileges. Pricing writes are validated server-side and audited with previous and new values. Admin role authorization uses the persisted user record; no browser-supplied role can grant access. Payment records are not editable through the admin API. Production static hosting must route `/login` and `/admin` to the React app entry point.

## Content and ebook status

The complete course has 43 valid lesson JSON files for the canonical 43 chapters. Run `npm run validate:curriculum` to check curriculum and lessons, and `npm run validate:content:complete` to require every lesson. Both validators should report zero missing chapters.

The ebook is generated from `src/data/curriculum.js` and the 43 lesson JSON files by `npm run ebook:build`. The script validates each lesson, lays out all eight parts, excludes assessment answer keys, and writes `content/ebooks/briane-dev-course.pdf`. It requires an installed Chromium-based browser (Chrome or Edge; set `PDF_BROWSER` to its executable when it is not in a standard location). The PDF is stored outside Vite's public directory and is delivered only by the API after a verified purchase.

Chapter 1 has a server-enforced public preview defined by stable block IDs. The preview contains only allowlisted blocks and omits objectives, narration, exercises, assessments, and progress. Full lessons, lesson assets, progress, exercises, assessments, ebook download, and certificate download are protected by the verified purchase check. Certificates are issued idempotently when the server's canonical completion evaluator accepts all 43 stable chapter IDs and their required activities. The certificate owner must sign in and retain course access to download the PDF; the public verification endpoint returns only certificate ID, validity, learner name, course title, and issue date.

## Frontend routes and API capabilities

Frontend routes are `/` (marketing, curriculum, pricing), `/learn/register`, `/learn/login`, `/learn` (learner dashboard), `/courses/:courseSlug/learn/:chapterId` (lesson reader), `/login` (Super Admin sign-in), and `/admin` (Super Admin dashboard). Static hosting must serve the React entry point for these deep links.

Learner API capabilities include authentication, public course metadata, public Chapter 1 preview delivery, purchase lookup, protected course progress and full lesson delivery, exercise acknowledgments, assessment submission, protected lesson image and ebook delivery, certificate listing and owner-only PDF download, and public certificate verification. Ebook status exposes availability without exposing the file. Payment and admin route details are listed in [`backend/README.md`](backend/README.md).

## Checks and deployment

Run `npm test`, `npm run lint`, and `npm run build` for automated tests, static checks, and the frontend production build. Run `npm run validate:curriculum` and `npm run validate:content:complete` to validate all canonical lesson content. Run `npm run ebook:build` to regenerate the ebook PDF from the course source; Chrome or Edge must be installed. A successful frontend build does not verify MongoDB seeding, Paystack configuration, or deployed service connectivity.

Deployment configuration is provided for Vercel (React frontend) and Render (Express API). Production details, environment variables, same-origin `/api` proxying, HTTPS cookies, MongoDB Atlas, and Paystack TEST-to-LIVE setup are maintained in [`backend/README.md`](backend/README.md). Keep backend secrets out of frontend variables and source control.
