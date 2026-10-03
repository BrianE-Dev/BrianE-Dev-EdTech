# BrianE-Dev API

Node.js, Express, Mongoose REST API for persistent course commerce and learning progress.

## Setup

1. Install project packages with `npm install`.
2. Copy `backend/.env.example` to `backend/.env` and configure MongoDB, `CLIENT_URL`, a random 32+ character `JWT_SECRET`, and the existing DevPortix Paystack test credentials (`PAYSTACK_SECRET_KEY`). Keep all secrets server-side. `PAYSTACK_PUBLIC_KEY` is documented for shared configuration, but the current checkout uses the authorization URL, so React does not need it.
3. Run `npm run seed` to upsert the published course and initial regional prices.
4. Run `npm run dev:all` from the root to start Vite and the API, or `npm run server:start` for the API alone.

Seed prices are configurable setup defaults: International is USD 15 with a 40% percentage discount (USD 9); Nigeria is independently set to NGN 15,000 with a 40% discount (NGN 9,000). The Nigerian value is not exchange-rate-derived. Discounts and dates are calculated by the API; React only displays the returned amount. Edit the regional configurations in the admin panel after creating an administrator.

## Super Admin

There is no default or publicly accessible admin account. To create one for development, set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (use a unique strong password), and optionally `SEED_ADMIN_NAME` in `backend/.env`, run `npm run seed`, then remove those variables. Registration always assigns the `user` role. Admin APIs check the persisted role.

## Paystack

Use the existing DevPortix Paystack business and its server-side credentials; BrianE-Dev does not require a separate Paystack business. Every BrianE-Dev transaction has a unique `BDE-YYYYMMDD-RANDOM` reference, `application: brianedev` metadata, product/pricing/user/region identifiers, and custom fields for Paystack dashboard identification. DevPortix and BrianE-Dev records remain separated by reference namespace and the `application` field. Configure the secret key only in backend environment variables. Set the webhook URL to `https://YOUR_API_HOST/api/brianedev/payments/paystack/webhook`; webhook signatures use `PAYSTACK_WEBHOOK_SECRET` when configured, otherwise the Paystack API secret key. The webhook re-verifies the transaction with Paystack before confirming it. Checkout uses a server-created authorization URL; the public key is not used by the current React flow. The callback URL is a return path only: course access is granted only after authenticated server-side Paystack verification or the signed webhook.

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

Authentication uses an HTTP-only, same-site cookie. Production must use HTTPS. Configure the exact frontend origin in `CLIENT_URL`; multiple origins may be comma-separated. Sensitive routes have rate limits and request validation. Payments are immutable through the admin API. Pricing writes create audit records.

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

The React project currently contains a public curriculum overview, not lesson bodies or a student dashboard. The API provides protected lesson, access, progress, and certificate operations; the lesson content/editor and learner UI require authored lesson data and can be added without trusting client-side completion state.
