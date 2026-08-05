# Building Salvio

Which command produces which app, and which backend it talks to.

Bundle ID / package: `com.juroctech.frontend` (both platforms).
EAS project: `1dc4c0a3-075a-4b96-8cd1-1f66b1d89362`.

---

## The one rule

`EXPO_PUBLIC_*` values are **baked in at build time**. A built app cannot be
repointed at a different backend — you rebuild. So the only thing that decides
whether a build hits dev or prod is *where its env came from*:

| Build method | Env comes from |
|---|---|
| `eas build --profile <name>` | the `env` block of that profile in `frontend/eas.json` |
| `npm start` / `expo start` | `frontend/.env` |
| `npm run build:aab` (local AAB) | `frontend/.env` |

The local AAB path is the trap: it is a **release** build for Google Play, but
it reads `frontend/.env` like a dev server does. If `.env` points at
`dev-api.juroc.tech` and you run `build:aab`, you will upload a Play release
wired to the dev database. Check `.env` before every local AAB.

---

## Environments

| Profile | Distribution | Backend | Use |
|---|---|---|---|
| `development` | internal, dev client | `frontend/.env` | Native debugging with a dev client |
| `preview` | internal (ad-hoc / APK) | `dev-api.juroc.tech` | Testing against dev, incl. IAP |
| `testflight-dev` | store | `dev-api.juroc.tech` | TestFlight testers on the dev backend |
| `production` | store | `api.juroc.tech` | TestFlight + App Store + Play release |

`preview` and `production` use **different RevenueCat projects**, not just
different backends. That is deliberate: the App User ID is `String(user.id)`
(`_layout.tsx:86`), and dev and prod have independent `id` sequences, so a
shared project would make dev user 7 and prod trainer 7 the same customer.
Keep the two projects' keys separate whenever you touch this file.

`preview` is **not** TestFlight. `distribution: internal` means an ad-hoc iOS
build installable only on devices registered via `eas device:create`, or a
directly-installable Android APK. Anything reaching TestFlight is a
`production` build and therefore hits prod.

### TestFlight against dev

```bash
eas build --profile testflight-dev --platform ios
eas submit --platform ios --latest
```

**Read this before using it.** `testflight-dev` and `production` share the
bundle ID `com.juroctech.frontend`, so both land in the *same* App Store
Connect app and the *same* TestFlight build list. Nothing in TestFlight's UI
shows which backend a build points at — the build number is the only
difference, and both profiles auto-increment the same counter.

The failure that matters: submitting a `testflight-dev` build for App Store
review would ship the public app pointed at the dev database. Guard against it:

- Put dev builds in their own TestFlight **internal group** (e.g. "Dev
  backend"), and never add them to the group you promote from.
- Record the build number when you submit a dev build. `eas build:list
  --profile testflight-dev` shows them.
- Only ever run `eas submit` for review from a `--profile production` build.

If TestFlight-against-dev becomes routine rather than occasional, the proper
fix is a separate bundle ID (`com.juroctech.frontend.dev`) via a dynamic
`app.config.js`. That gives a distinct App Store Connect app, its own
TestFlight, and side-by-side install on one device — at the cost of recreating
the IAP products under the new app, since in-app purchases are per-app in App
Store Connect.

---

## Everyday: no build at all

Most work needs no build. Point the dev server at whichever backend you want:

```bash
# frontend/.env
EXPO_PUBLIC_API_URL=https://dev-api.juroc.tech   # or http://localhost:8000
```

```bash
cd frontend
npx expo start -c
```

The `-c` clears the cache. Expo caches env vars, and without it you will keep
hitting the previous backend while believing you switched.

Covers everything except in-app purchases — RevenueCat is a native module and
does not run in Expo Go.

---

## Testing against dev (incl. purchases)

```bash
cd frontend
eas build --profile preview --platform android   # installable APK, least friction
eas build --profile preview --platform ios       # needs device registration first
```

For iOS, register each tester device once:

```bash
eas device:create
```

Purchases in these builds run against the store sandbox and the **dev**
RevenueCat project, so they cannot touch real subscribers.

---

## Releasing

```bash
cd frontend
npx tsc --noEmit                                  # typecheck first
eas build --profile production --platform ios
eas submit --platform ios --latest                # → App Store Connect → TestFlight
```

`production` sets `autoIncrement`, so the build number rises automatically; the
user-facing version comes from `version` in `app.json`.

### Android release

Either EAS:

```bash
eas build --profile production --platform android
```

Or build the AAB locally and upload it to Play Console by hand:

```bash
cd frontend
npm run build:aab            # gradle bundleRelease → android/app/build/outputs/bundle/release/app-release.aab
npm run build:aab:release    # same, but bumps the Android version code first
```

Local AAB signing uses the upload keystore in `~/.gradle/gradle.properties`.
Re-read the one rule above before running it: this path takes its API URL from
`frontend/.env`, not from `eas.json`.

---

## Verifying what a build points at

Before shipping, confirm the backend baked in:

```bash
cd frontend
grep EXPO_PUBLIC_API_URL .env          # governs expo start and build:aab
grep -A3 '"production"' eas.json       # governs eas build --profile production
```

In a running build, the resolved value is `API_URL` from
`src/constants/config.ts`. `EXPO_PUBLIC_API_URL` takes priority over the
`_DEV` / `_PROD` fallbacks, so if it is set, it wins everywhere.

---

## Related

- Dev backend setup: [dev-environment-setup.md](dev-environment-setup.md)
- Server deploy: [../server/DEPLOY.md](../server/DEPLOY.md)
