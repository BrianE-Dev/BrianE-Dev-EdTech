# BrianE-Dev API

Node.js, Express, Mongoose REST API for persistent course commerce and learning progress.

## Setup

1. Install project packages with `npm install`.
2. Copy `backend/.env.example` to `backend/.env` and configure MongoDB, `CLIENT_URL`, a random 32+ character `JWT_SECRET`, and the existing DevPortix Paystack TEST credentials. Keep all credentials server-side. The Paystack public key is required in backend configuration but is not needed by the current authorization-URL checkout and is never returned to React.
3. Set `MONGODB_URI` to a reachable local MongoDB URI or Atlas `mongodb+srv://...` URI. The example leaves it blank intentionally. Configure Atlas network access and the database user before seeding.
4. Run `npm run seed` to upsert the published course and initial regional prices.
5. Run `npm run dev:all` from the root to start Vite and the API, or `npm run server:start` for the API alone.

Both the API and seed load `backend/.env` by its file location, regardless of the current working directory. The API validates Paystack configuration and connects to MongoDB before listening; startup fails with an actionable error if either configuration or MongoDB is invalid/unavailable. Logs never include credential values or the MongoDB URI. The seed command does not require Paystack credentials, disconnects in a `finally` block, and reports the seeded course section/chapter counts and regional pricing count on success. A MongoDB connection is required to verify seed persistence; frontend build/lint checks alone do not establish that database contents were written.

Seed prices are configurable setup defaults: International is USD 15 with a 40% percentage discount (USD 9); Nigeria is independently set to NGN 15,000 with a 40% discount (NGN 9,000). The Nigerian value is not exchange-rate-derived. Discounts and dates are calculated by the API; React only displays the returned amount. Edit the regional configurations in the admin panel after creating an administrator.

## Super Admin

There is no default or publicly accessible admin account. To create one for development, set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (use a unique strong password), and optionally `SEED_ADMIN_NAME` in `backend/.env`, run `npm run seed`, then remove those variables. Registration always assigns the `user` role. Admin APIs check the persisted role. Use the React `/login` page to sign in; only a persisted `super_admin` account can open `/admin`, the commerce dashboard. Configure production static hosting to route these paths to the React app entry point.

## Paystack

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
- `GET /api/pricing` (uses authenticated country first, then Cloudflare/Vercel country headers, then international USD fallback)
- `GET /api/courses`, `GET /api/courses/:slug`
- `POST /api/brianedev/payments/initialize` with `{ "productId": "ai-powered-developer-productivity" }`, `POST /api/brianedev/payments/verify` with `{ "reference": "BDE-..." }`, `POST /api/brianedev/payments/paystack/webhook` (compatibility aliases remain under `/api/payments/*`)
- `GET /api/me/purchases`, `GET /api/me/progress/:courseId`, `GET /api/me/certificates`
- `GET /api/courses/:courseId/lessons/:chapterId` (requires a paid BrianE-Dev purchase)
- `POST /api/courses/:courseId/progress/:chapterId` (requires purchase; completion creates one certificate)
- `GET /api/certificates/verify/:certificateId`
- Super Admin: `GET /api/admin/pricing`, `PUT /api/admin/pricing/:region`, `GET /api/admin/transactions`, `GET /api/admin/purchases`, `GET /api/admin/certificates`

Authentication uses an HTTP-only, same-site cookie. Production must use HTTPS. Configure the exact frontend origin in `CLIENT_URL`; multiple origins may be comma-separated. Sensitive routes have rate limits and request validation. Payments are immutable through the admin API. Pricing writes create audit records. Mongoose uses unique indexes for emails, course slugs, pricing regions, payment references, Paystack references, and certificate IDs; compound indexes support environment-isolated payment administration and one-progress/one-certificate-per-user/course lookups.

## Payment and completion rules

The browser submits a product ID only; it cannot submit amount, currency, region, or discount. The backend selects the course and regional MongoDB price, computes the discount and final amount, generates a `BDE-YYYYMMDD-RANDOM` reference, and writes a pending payment snapshot before calling Paystack. The payment snapshot stores application/product identity, user/course, Paystack reference, pricing record ID, region, original/final amounts, discount details, and currency. Paystack receives corresponding application/product/user/region/pricing metadata and dashboard custom fields.

After checkout, the React return handler sends the reference to `/api/brianedev/payments/verify`. That endpoint requires the authenticated owner and verifies the reference directly with Paystack. The signed webhook at `/api/brianedev/payments/paystack/webhook` independently verifies the transaction. Both paths compare the payment record's application, product, reference, amount in minor units, and currency before setting `paid`. Unique references and conditional state changes make duplicate webhook deliveries idempotent. Only `paid` (plus the legacy `successful` state for older records) BrianE-Dev payments grant access. Progress tracks database chapter identifiers; reaching 100% for a certificate-eligible course creates one certificate.

## Production checklist

- Use managed MongoDB with network restrictions and backups.
- Set production-only random secrets, HTTPS, exact CORS origins, and Paystack live keys in the deployment secret manager.
- Deploy the API separately from the static React frontend; set `VITE_API_URL` at frontend build time.
- Set Paystack's webhook URL to the deployed API endpoint.
- Run the seed command once against the intended database; avoid development seed credentials in production.
- Promote the first Super Admin through a trusted database/operations process. Never add admin role assignment to public registration.
- Configure Cloudflare/Vercel or another trusted reverse proxy to overwrite country headers before forwarding them. Do not accept browser-supplied country values for pricing. Unknown visitors use international USD.

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

The React project currently contains a public curriculum overview, not lesson bodies or a student dashboard. The API provides protected lesson, access, progress, and certificate operations; the lesson content/editor and learner UI require authored lesson data and can be added without trusting client-side completion state.
