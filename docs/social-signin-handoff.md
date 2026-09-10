# Sign in with Google + Apple — handoff

Status as of **2026-09-05**, branch `dev`.

Implementation is **complete and green** (server 305 tests / 31 suites, frontend 86 tests,
both typecheck clean). What remains is external console setup and a device build —
none of it can be done from the code alone.

> **Before you leave this machine:** the work is currently uncommitted. See
> [Getting the code to the other machine](#0-getting-the-code-to-the-other-machine).

---

## 0. Getting the code to the other machine

At the time of writing, all 29 changed/new files are **uncommitted** on `dev`
(`origin/dev` is still at `9835f86`). Commit and push, or none of this travels:

```bash
git add -A && git commit && git push origin dev
```

Two files are gitignored and will **not** come across — recreate them (§4).

---

## 1. What was built

Sign in with Google (iOS + Android) and Sign in with Apple (iOS only). Apple
requires the latter on iOS once you offer any other third-party login
(guideline 4.8), so the pair ships together.

### The flow

```
tap Google/Apple  ->  native SDK returns an ID token (a JWT)
                  ->  POST /auth/social { provider, idToken, firstName?, lastName? }
                  ->  server verifies the JWT against the provider's JWKS
       +---------------------+---------------------+
  known provider id            OR            brand new
  or matching verified email                      |
       |                                          v
       v                       200 { needsProfile: true, pendingToken, ... }
  200 AuthResponse             -> /(auth)/complete-profile  (name + phone)
  (token, refreshToken, user)  -> POST /auth/social/complete { pendingToken, ... }
                               -> 201 AuthResponse
```

### Why the two-step signup

Salvio requires a Romanian phone number and **neither provider returns one**.
Apple additionally hands over the user's name only on the *very first*
authorization, and never inside the token — while `first_name`/`last_name` are
`NOT NULL`.

So a first-time social sign-in returns a signed, 15-minute `pendingToken` rather
than a session. **No user row is written until the phone is supplied**, which
keeps `phone` mandatory and avoids half-built accounts every other screen would
have to cope with. Backing out of the form leaves nothing behind.

### Decisions already taken

| Decision | Choice |
|---|---|
| Missing phone number | Complete-profile step (not a nullable phone) |
| Account linking | Link by **verified** email; unverified claims never link |
| Apple on Android | Not supported — would need a Services ID, a server redirect, and a `.p8` client secret re-minted every 6 months |
| Social buttons on `Welcome.tsx` | Skipped — nothing navigates there (`RequireAuth` is never mounted) |

---

## 2. Files changed

### Server

| File | What |
|---|---|
| `src/services/socialAuth.ts` **(new)** | `verifySocialIdToken(provider, idToken)` — one `jose`-backed path for both providers |
| `src/controllers/auth.ts` | `socialAuth` + `socialAuthComplete` handlers; extracted `issueSession()`; social-account guard in `login` |
| `src/models/user.ts` | `googleId`/`appleId` columns; `password` now optional; guard inside `comparePassword`; new `hasPassword()` |
| `src/utils/jwt.ts` | `generateSocialSignupToken` / `verifySocialSignupToken` |
| `src/middleware/validation.ts` | `socialAuthValidation`, `socialCompleteValidation` |
| `src/routes/auth.ts` | `POST /auth/social`, `POST /auth/social/complete` |
| `src/services/databaseBootstrap.ts` | Idempotent `ALTER TABLE users` migration |
| `src/types/user.ts` | Optional `password`, provider id fields |
| `src/tests/setup.ts` | Raised the auth rate limit for tests |

### Frontend

| File | What |
|---|---|
| `src/lib/socialAuth.ts` **(new)** | The only file that touches the native SDKs |
| `src/lib/socialAuthErrors.ts` **(new)** | Pure cancel-vs-error logic, kept react-native-free so it is testable |
| `src/components/SocialAuthButtons.tsx` **(new)** | Owns press -> verify -> branch; used by both screens |
| `app/(auth)/complete-profile.tsx` **(new)** | Name + phone step |
| `features/auth/authApiSlice.ts` | `useSocialAuthMutation`, `useCompleteSocialSignupMutation`, `needsProfile()` guard |
| `src/screens/Login.tsx`, `SignUp.tsx` | Buttons dropped below the "or" divider both already had |
| `src/lib/i18n/translations.ts` | 6 keys × EN/RO |
| `app.json`, `eas.json`, `.env.example` | Plugins, entitlement, client ids |

### Notable implementation details

- **`jose` is pinned to v5, not v6.** v6 is ESM-only and this server is CommonJS —
  `require('jose')` fails at runtime, not just under Jest. Do not "upgrade" it
  without converting the server to ESM.
- **`sequelize.sync({ alter: false })` never touches an existing table**, so the
  new columns are added by raw SQL in `databaseBootstrap.ts`, matching the
  existing pattern there.
- **`ALTER COLUMN password_hash DROP NOT NULL`** — social accounts have no
  password at all, rather than a random unusable hash.
- **Do not insert a `@Column` between lines ~193-198 of `models/user.ts`** — the
  `@HasMany(() => Review)` there is (pre-existing bug) decorating a *method*, and
  a new column in that gap would re-target it.
- **On Android the Google SDK mints its ID token against the WEB client id**, not
  the Android one. The server must accept the web id as an audience or every
  Android sign-in fails.
- Verification **fails closed**: with no audience configured, the provider is
  refused rather than accepting a token minted for anyone's app.

---

## 3. What is left to do

### 3a. Google Cloud Console — blocks all testing

OAuth consent screen, then three client IDs:

| Type | Settings | Used as |
|---|---|---|
| **Web** | — | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` + primary server audience |
| **iOS** | bundle `com.juroctech.frontend` | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; its *reversed* form is `iosUrlScheme` |
| **Android** | package `com.juroctech.frontend` + SHA-1 from `eas credentials` | (no client-side value) |

Add **both** the EAS-managed release SHA-1 and your local debug SHA-1.

### 3b. Apple Developer

Certificates, IDs & Profiles -> App ID `com.juroctech.frontend` -> enable the
**Sign in with Apple** capability. No Services ID or `.p8` needed (iOS native only).

### 3c. Replace the placeholders

Search for `REPLACE_WITH` — three spots:

- `frontend/app.json` -> the Google plugin's `iosUrlScheme`
  (`com.googleusercontent.apps.<REVERSED_IOS_CLIENT_ID>`).
  **This one fails silently at runtime if left unreplaced** — prebuild will not complain.
- `frontend/eas.json` -> `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, in **all three** profiles
  (`preview`, `testflight-dev`, `production`).

### 3d. Server `.env` on the VPS

```bash
GOOGLE_OAUTH_AUDIENCES=<web-client-id>,<ios-client-id>
APPLE_BUNDLE_ID=com.juroctech.frontend
```

Both are documented in `server/.env.example`. Without them the matching provider
returns "sign-in is not configured on this server".

> Per the usual rule: run VPS commands yourself, they are not run from here.

### 3e. Build

Two native modules were added, so this needs a fresh build — no OTA, no Expo Go:

```bash
cd frontend
npx expo prebuild --clean
npm run android      # or: npx expo run:ios
```

Apple sign-in **does not work in the iOS simulator** without a signed-in Apple ID
— use a real device.

### 3f. Version bump (your call)

`ios.buildNumber` (currently `45`) and `android.versionCode` (currently `19`) were
deliberately **not** bumped — that is a release decision.

---

## 4. Local dev setup on the new machine

### `server/.env.test` — gitignored, recreate it

```
NODE_ENV=test
PORT=8001
DB_NAME=trainee_test
DB_USER=admin
DB_PASS=admin
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=test-jwt-secret-for-testing-only
CHECKIN_CODE_SECRET=test-checkin-secret-for-testing-only
BCRYPT_ROUNDS=4
```

### Test database

`server/docker-compose.yml` is the **production VPS stack** (nginx, certbot,
absolute `/home/robi/...` paths) and its Postgres publishes no host port — it
cannot serve local tests. Use a throwaway container:

```bash
docker run -d --name trainee_test_db \
  -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=admin -e POSTGRES_DB=trainee_test \
  -p 5432:5432 postgis/postgis:16-3.4
```

Remove with `docker rm -f trainee_test_db`. **One is currently left running on the
original machine.**

PostGIS specifically — the bootstrap needs the `postgis`, `pg_trgm` and `unaccent`
extensions.

### `server/.env` and `frontend/.env`

Also gitignored. Copy from the corresponding `.env.example` and fill in.
Note `frontend/.env`'s `EXPO_PUBLIC_API_URL` is toggled by hand between prod and
local Docker — that is deliberate, not a bug to fix.

---

## 5. Verifying it still works

```bash
cd server   && npx tsc --noEmit && npm test     # 305 tests, 31 suites
cd frontend && npx tsc --noEmit && npm test     # 86 tests, 7 suites
```

### Test coverage added (47 tests)

| File | Covers |
|---|---|
| `server/src/tests/socialAuthVerify.test.ts` (16) | Real RS256 tokens against a local key set: forged signature, wrong `aud`, wrong `iss`, expired, missing email, Apple's string `"true"`, private relay addresses, cross-provider confusion, fail-closed when unconfigured |
| `server/src/tests/socialLogin.test.ts` (26) | Both endpoints end to end: first-time -> complete, returning user, linking by verified email, refusing to link unverified, pendingToken replay (409), access token used as pendingToken (401) and vice versa, RO phone rules, provider cancel |
| `server/src/tests/socialAuthMigration.test.ts` (5) | Rewinds the DB to today's production schema and asserts the bootstrap migration lands, is idempotent, enforces provider-id uniqueness, and still allows many NULLs |
| `frontend/src/lib/__tests__/socialAuthErrors.test.ts` (12) | Cancel vs. real error — getting this wrong shows an error alert every time someone dismisses the native sheet |

The migration test matters most: every other suite builds its tables fresh from
the models and so never exercises the raw-SQL migration path that production
actually takes.

### Manual end-to-end, per provider

- [ ] Brand-new account -> complete-profile -> lands on Home; row has the provider
      id and `password_hash IS NULL`
- [ ] Sign out, sign in again -> straight in, **no** complete-profile screen
- [ ] Existing password account, same Gmail address -> links; password still works
- [ ] That social-only account at `/login` with a password ->
      *"This account uses Google or Apple sign-in."*
- [ ] Cancel the native sheet -> returns quietly, no error alert
- [ ] Both EN and RO copy render on the new screen

---

## 6. Known gaps / deliberate omissions

- **Apple sign-in on Android** — not supported. Add only if real users ask; it
  needs a Services ID, a `/auth/apple/callback` on the server, and `.p8`
  client-secret signing with a 6-month rotation to remember.
- **`forgot-password` was left alone.** A social-only user *can* request a reset
  and set a password, gaining a second way in. That is a feature, not a bug.
- **The auth rate limit was raised in `src/tests/setup.ts`**, not `.env.test`
  (which is untracked and would not travel). The real limit is 25 per 15 min per
  IP, and the pre-existing `auth.test.ts` sat right at that boundary — it was one
  test away from flaking for anyone else running the suite.
