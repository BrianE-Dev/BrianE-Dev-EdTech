# BrianE-Dev API

Node.js, Express, Mongoose REST API for persistent course commerce and learning progress.

## Setup

1. Install project packages with `npm install`.
2. Copy `backend/.env.example` to `backend/.env` and configure MongoDB, `CLIENT_URL`, a random 32+ character `JWT_SECRET`, and Paystack test keys.
3. Run `npm run seed` to upsert the published course and initial regional prices.
4. Run `npm run dev:all` from the root to start Vite and the API, or `npm run server:start` for the API alone.

Seed prices are configurable setup defaults: International is USD 15 with a 40% percentage discount (USD 9); Nigeria is independently set to NGN 15,000 with a 40% discount (NGN 9,000). The Nigerian value is not exchange-rate-derived. Edit it in admin after creating an administrator.

## Super Admin

There is no default or publicly accessible admin account. To create one for development, set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (use a unique strong password), and optionally `SEED_ADMIN_NAME` in `backend/.env`, run `npm run seed`, then remove those variables. Registration always assigns the `user` role. Admin APIs check the persisted role.

## Paystack

Use test keys until the integration is reviewed in Paystack test mode. Configure the secret key only in the backend environment. Set the Paystack webhook URL to `https://YOUR_API_HOST/api/payments/paystack/webhook`; webhook signatures are verified using the HMAC-SHA512 signature Paystack sends in `x-paystack-signature`, with the secret key. `PAYSTACK_WEBHOOK_SECRET` is reserved for environment parity; Paystack signs webhooks with the API secret key. The webhook re-verifies the transaction with Paystack before confirming it. The public key is not currently needed because checkout uses the server-created authorization URL.

## API

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/pricing` (uses authenticated country first, then Cloudflare/Vercel country headers, then international USD fallback)
- `GET /api/courses`, `GET /api/courses/:slug`
- `POST /api/payments/initialize`, `POST /api/payments/verify`, `POST /api/payments/paystack/webhook`
- `GET /api/me/purchases`, `GET /api/me/progress/:courseId`, `GET /api/me/certificates`
- `GET /api/courses/:courseId/lessons/:chapterId` (requires successful purchase)
- `POST /api/courses/:courseId/progress/:chapterId` (requires purchase; completion creates one certificate)
- `GET /api/certificates/verify/:certificateId`
- Super Admin: `GET /api/admin/pricing`, `PUT /api/admin/pricing/:region`, `GET /api/admin/transactions`, `GET /api/admin/purchases`, `GET /api/admin/certificates`

Authentication uses an HTTP-only, same-site cookie. Production must use HTTPS. Configure the exact frontend origin in `CLIENT_URL`; multiple origins may be comma-separated. Sensitive routes have rate limits and request validation. Payments are immutable through the admin API. Pricing writes create audit records.

## Payment and completion rules

The browser submits a course slug only. The backend selects the regional MongoDB price and currency, initializes Paystack and persists a pending reference. Both the user return verification and webhook verify the transaction against Paystack and compare reference, smallest currency units, and currency before setting success. Payment reference uniqueness and state checks make webhook delivery idempotent. Access is granted by successful payment records. Progress tracks chapter IDs from the database course; reaching 100% for an eligible course creates one certificate.

## Production checklist

- Use managed MongoDB with network restrictions and backups.
- Set production-only random secrets, HTTPS, exact CORS origins, and Paystack live keys in the deployment secret manager.
- Deploy the API separately from the static React frontend; set `VITE_API_URL` at frontend build time.
- Set Paystack's webhook URL to the deployed API endpoint.
- Run the seed command once against the intended database; avoid development seed credentials in production.
- Promote the first Super Admin through a trusted database/operations process. Never add admin role assignment to public registration.
- Configure the production location provider or edge country header if country-specific pricing needs more than the authenticated user's saved country. Unknown visitors use international USD.

The React project currently contains a public curriculum overview, not lesson bodies or a student dashboard. The API provides protected lesson, access, progress, and certificate operations; the lesson content/editor and learner UI require authored lesson data and can be added without trusting client-side completion state.
