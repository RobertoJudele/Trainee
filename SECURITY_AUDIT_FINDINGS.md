# Security & Functionality Audit — Findings & Remediation

_Audit date: 2026-06-08. Scope: full backend (`server/`) — every route, controller, middleware, model — plus the frontend data/auth layer. Both projects pass `tsc --noEmit`._

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low/Info

Checkbox meaning: `[ ]` = not started, `[x]` = done.

---

## 🔴 CRITICAL

### [ ] 1. Real secrets committed to git (`server/.env`)
`server/.env` is tracked in the repo (the `.gitignore` rule was added after the file was committed, so it does not untrack it). It contains live values: `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`, `STRIPE_SECRET_KEY`, `GOOGLE_PLACES_API_KEY`, `REVENUECAT_SECRET_API_KEY`, `SMTP_PASS`, `DB_PASS`, `JWT_SECRET`, `CHECKIN_CODE_SECRET`.

**Requires owner action (cannot be done in code):**
- [ ] Rotate **every** secret listed above — assume all are compromised (they are in history and likely pushed).
- [ ] `git rm --cached server/.env` and commit.
- [ ] Purge from git history (BFG or `git filter-repo`) and force-push.
- [ ] Prioritise the AWS key — exposed AWS secrets are abused for resource/billing fraud within minutes. Check CloudTrail for unexpected use.
- [ ] Confirm `server/.env.example` stays as the only committed env file.

---

## 🟠 HIGH

### [ ] 2. Unauthenticated Stripe billing endpoints — IDOR
Files: `server/src/routes/index.ts:40-53`, `server/src/routes/billing.ts:38-51`, `server/src/controllers/billing.ts:863` (`createPortalSession`).

`/create-portal-session` and `/create-checkout-session` have no `authenticate`. `createPortalSession` takes `customerId` straight from the body and opens a Stripe billing portal for it — anyone who supplies/guesses a `cus_…` ID can view invoices/payment methods and cancel another customer's subscription.

- [ ] Add `authenticate` to both routes (and remove the duplicate definitions — they exist in both `index.ts` and `billing.ts`).
- [ ] In `createPortalSession`, resolve the trainer from `req.user` and verify the requested customer matches `trainer.stripeCustomerId`.

---

## 🟡 MEDIUM

### [ ] 3. RevenueCat webhook fails open
File: `server/src/controllers/billing.ts:210` (`isRevenueCatWebhookAuthorized`). Returns `true` for everyone when `REVENUECAT_WEBHOOK_AUTH` is unset. Partly mitigated by the server-side subscriber re-fetch, but the default is wrong.
- [ ] Require `REVENUECAT_WEBHOOK_AUTH`; reject (401) if it is not configured.

### [ ] 4. Specialization creation missing admin check + missing try/catch
Files: `server/src/routes/specialization.ts:19`, `server/src/controllers/specializations.ts:21`.
Any authenticated user can create specializations. The controller also has no try/catch, so a DB error (e.g. duplicate name) leaves the request hanging (Express 4 doesn't catch async throws).
- [ ] Add `requireAdmin` to the `POST /` route.
- [ ] Wrap `createSpecialization` in try/catch with `sendError`.

### [ ] 5. No security headers + permissive CORS
File: `server/src/index.ts:41`. No `helmet`; CORS is `origin: true` + `credentials: true` (reflects any origin).
- [ ] Add `helmet()`.
- [ ] Restrict CORS origins for any web surface (mobile clients don't need permissive CORS).

### [ ] 6. Spoofable rate-limit key + non-distributed store
File: `server/src/middleware/rateLimit.ts:55` (`getClientIp`). Reads raw `X-Forwarded-For[0]`, which a client can set, bypassing IP-based limits (including login).
- [ ] Use `req.ip` (trust proxy is already configured) instead of parsing XFF manually.
- [ ] For multi-instance deploys, back the limiter with Redis (in-memory store is per-process and resets on restart).

### [ ] 7. No brute-force protection on 6-digit check-in codes
Files: `server/src/controllers/trainerSchedule.ts` (assign-by-code / check-in), `server/src/routes/trainerSchedule.ts`. 1,000,000 code space, 10-min TTL, only `authenticate` on the routes — a malicious trainer could brute-force codes.
- [ ] Add a dedicated rate limiter / per-user attempt cap on code-resolving endpoints.

### [ ] 8. Image upload trusts client MIME + arbitrary extension (stored-XSS risk)
File: `server/src/config/s3.ts:22-34` (filter) and `:71` (`generateS3key` keeps original extension); bucket is `public-read`. An `image/svg+xml` upload (SVG can carry JS) becomes stored XSS if opened in a browser.
- [ ] Validate real magic bytes (not just the client MIME).
- [ ] Block SVG, and/or set `Content-Disposition: attachment` and a fixed safe extension.

### [ ] 9. `/auth/refresh` has no rate limit
File: `server/src/routes/auth.ts:20`. Unauthenticated and hits the DB.
- [ ] Add `authRateLimit` (or a dedicated profile) to the refresh route.

---

## 🟢 LOW / INFO

### [ ] 10. Info leak in register error response
File: `server/src/controllers/auth.ts:86`. Passes the raw Sequelize `error` object to the client. Send only the mapped field errors.

### [ ] 11. Token storage on device
Frontend persists access **and** 7-day refresh token in AsyncStorage (unencrypted) via redux-persist. Consider `expo-secure-store`.

### [ ] 12. Misplaced Sequelize decorator
File: `server/src/models/user.ts:193`. `@HasMany(() => Review)` sits above the `generateEmailVerificationToken()` method instead of a property — the Review association is likely misregistered. Move it above a proper association property and verify review→user joins.

### [ ] 13. Stripe webhook idempotency
File: `server/src/controllers/billing.ts:900` (`stripeWebhook`). Unlike the RevenueCat handler (which dedupes via `BillingWebhookEvent`), the Stripe handler doesn't record processed event IDs. Mostly harmless (sync is idempotent-ish) but inconsistent.
- [ ] Record processed Stripe event IDs and short-circuit duplicates.

### [ ] 14. Config polish
File: `frontend/src/constants/config.ts:20,26`. Default prod API URL is the placeholder `https://your-production-api.com`; the API URL is `console.log`'d.
- [ ] Fail loudly if no prod API URL is configured; drop/guard the log.

### [ ] 15. No automated tests
Neither project has a test suite — "working" is currently only verified by typecheck + manual use.
- [ ] Add at least auth + billing-authorization integration tests.

---

## ✅ Already solid (no action needed)
- bcrypt hashing (rounds 12); 15-min JWT + rotating refresh tokens.
- No user enumeration on login / forgot-password.
- Parameterized geo SQL — all `lat/lng/radius` are coerced via `toFiniteNumber` and range-validated before any `Sequelize.literal`; **no SQL injection**.
- Thorough `express-validator` rules + strict-schema unknown-field rejection.
- Ownership-scoped schedule queries (`trainerId: trainer.id`, `clientId: user.id`) — no IDOR in scheduling.
- Hashed, single-use, TTL'd check-in codes.
- Correct Stripe webhook signature verification (`constructEvent` on raw body).
- Mutex-guarded token-refresh flow on the client.

---

## Suggested quick-win batch (low-risk code fixes, no UX change)
#2 (auth billing endpoints), #4 (admin guard + try/catch), #5 (helmet), #6 (req.ip), #9 (refresh rate limit), #10 (register leak).
Leave #1 (secret rotation + history purge) and #11 to the owner.
