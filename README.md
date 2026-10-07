# BrianE-Dev

AI-powered developer productivity learning for software engineers. The course focuses on using AI throughout the software lifecycle; code provides context for lessons, examples, and workflows.

The approved course title, 8 sections, 43 chapters, and stable section/chapter IDs are centralized in [`src/data/curriculum.js`](src/data/curriculum.js) at curriculum version `1.0.0`. Lesson-content contracts and curriculum validation live under `src/data/schemas/` and `src/data/validation/`. See [`DOCUMENTATION.md`](DOCUMENTATION.md) for the course overview and project setup.

## Run locally

```sh
npm install
npm run dev
```

## Commerce backend

The API is a separate Express service backed by MongoDB. See [`backend/README.md`](backend/README.md) for database setup, Paystack configuration, development Super Admin creation, webhook setup, deployment, and API details.

Copy `backend/.env.example` to `backend/.env`, configure MongoDB and server-only credentials for the existing DevPortix Paystack integration, then run:

```sh
npm run seed
npm run dev:all
```

Validate curriculum/content structure and run the automated tests with:

```sh
npm run validate:curriculum
npm test
```

The seed command creates the published 8-section, 43-chapter course and initial prices (international: USD 15 with a 40% promotion; Nigeria: independently configurable NGN 15,000 with a 40% promotion). It does not create an admin unless temporary `SEED_ADMIN_*` values are provided. BrianE-Dev Paystack references use the `BDE-` namespace and transactions include a `brianedev` application identifier, so they remain distinguishable when using the shared DevPortix Paystack business.

Local development uses `APP_ENV=development` and Paystack TEST credentials. Production uses `APP_ENV=production` and LIVE credentials. The backend validates required Paystack variables and known key prefixes at startup; credentials and webhook secrets stay backend-only. See [`backend/README.md`](backend/README.md) for the environment variable list and live migration setup.

The detailed payment metadata, authenticated callback verification, signed webhook endpoint, route list, data model, security notes, and deployment instructions are in [`backend/README.md`](backend/README.md).

The React app includes learner sign-in and free account registration at `/learn/login` and `/learn/register`, a learner dashboard at `/learn`, and lesson reading at `/courses/:courseSlug/learn/:chapterId`. Registration creates an account only; the Chapter 1 preview is public, and the backend grants full lessons, assessments, progress, ebook, and certificate eligibility only after a verified paid purchase. The 43 authored lessons remain validated JSON under `content/lessons/`. Paid learners can download the course ebook; eligible completers can download an owner-protected Certificate of Completion PDF and share its public verification endpoint. Progress, required exercise acknowledgment, assessment retries, and certificate eligibility are evaluated and stored server-side.

Super Admin sign-in is available at `/super-admin`; the protected commerce dashboard is at `/admin`. Accounts are created through the documented seed/admin setup and there is no public Super Admin registration. Production static hosting must serve the React app entry point for these paths.

## Deploy frontend and backend

Deployment files are included for Vercel (`vercel.json`) and Render (`render.yaml`). Import the repository into Vercel with the project root as the root directory; it builds the Vite app to `dist` and rewrites `/api/*` to the Render API, while the final rewrite supports `/super-admin` and `/admin` deep links. The frontend defaults to same-origin `/api` in production and `http://localhost:4000/api` in local development. If the Render service name changes from `briane-dev-api`, update its external rewrite target in `vercel.json`.

Create the Render Blueprint service and supply its prompted secrets in Render. Start with `APP_ENV=development` and Paystack TEST credentials; the blueprint sets `NODE_ENV=production` so deployed cookies use HTTPS. Configure Atlas `MONGODB_URI`, a Vercel `CLIENT_URL`, JWT secret, and test Paystack keys/webhook secret. After deploying Vercel, set Render's `CLIENT_URL` to the deployed Vercel origin, then redeploy the API. Add the Paystack TEST webhook URL as `https://briane-dev-api.onrender.com/api/brianedev/payments/paystack/webhook`. Run `npm run seed` from a trusted environment connected to the intended Atlas database. See [`backend/README.md`](backend/README.md) for the full variable list and eventual LIVE-mode switch.

## Project checks

```sh
npm run lint
npm run build
```
