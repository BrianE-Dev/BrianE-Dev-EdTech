# Business platform and account security

## Available locally

- Public `/services`, `/contact`, and `/quote` pages submit validated requests to MongoDB.
- Requests receive server-generated `BD-ENQ-YYYY-NNNNNN` or `BD-QUO-YYYY-NNNNNN` references from an atomic counter with a unique index.
- Super-admin business overview, request search/status changes/internal notes, request CSV export, contact list/lead status/notes, and draft campaign creation are available under `/admin`.
- Newly registered users have `emailVerified: false`, receive no authenticated session at registration, and are blocked by backend authentication and course-content checks until verification. Legacy records without this field remain usable; super-admins bypass the check.
- Verification and password-reset tokens are random, single-use, stored only as SHA-256 hashes, and expire after 24 hours and 1 hour respectively. Password reset increments `sessionVersion` to invalidate existing sessions.
- Local non-production API responses expose a development-only token so the verification and reset flows can be exercised without a mail server.
- Requests and authentication routes have rate limits. Email send attempts are not simulated.

## Deferred external activation

No email transport is present in the current backend. The application reports email delivery unavailable and does not claim to send verification, password recovery, enquiry acknowledgements, or campaign email. Production verification cannot complete until an authenticated SMTP transport and branded templates are implemented and configured.

After Hostinger access is restored, the backend email transport will need a documented configuration extension using the following settings (never commit their values):

- `MAIL_HOST`: Hostinger SMTP hostname.
- `MAIL_PORT`: SMTP port supplied by Hostinger.
- `MAIL_SECURE`: whether that port requires TLS from connection start.
- `MAIL_USER`: mailbox username, expected to be `info@briane-dev.online`.
- `MAIL_PASSWORD`: mailbox SMTP password.
- `MAIL_FROM_EMAIL`: intended sender address, `info@briane-dev.online`.
- `MAIL_FROM_NAME`: intended display name, `BrianE-Dev`.
- `PUBLIC_APP_ORIGIN`: canonical trusted link origin, `https://briane-dev.online` in production.

These settings are not currently read by code, so adding them now will not activate email. Before production use, implement and validate the SMTP transport, responsive HTML/plain-text templates, resend throttling, reset notifications, and a real authorized delivery test. DNS values for SPF, DKIM, and DMARC must come from Hostinger; no record values have been guessed here.

Campaigns currently support drafts only. There is no recipient snapshot, consent-enforced delivery queue, unsubscribe endpoint, delivery event/webhook integration, or durable scheduler. The schedule endpoint returns HTTP 503 with the unavailable reason. Campaign sending, analytics, and autonomous scheduling are not operational.

## Local checks

Run `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run lint` from the repository root. The business APIs require a connected MongoDB database; public form submissions persist before any email state is reported.
