# Force Update

Blocks users on an outdated app version with a non-dismissible "Update Required"
wall that deep-links to the App Store / Google Play. The minimum version and
message live in a database row, so you change them **without a redeploy**.

Design spec: [docs/superpowers/specs/2026-07-02-force-update-design.md](superpowers/specs/2026-07-02-force-update-design.md)
Implementation plan: [docs/superpowers/plans/2026-07-02-force-update.md](superpowers/plans/2026-07-02-force-update.md)

## How it works

1. On launch the app sends its version + platform to `GET /version/check`.
2. The backend compares it against the `app_min_version` row for that platform
   and replies `{ updateRequired, message, storeUrl }`.
3. If `updateRequired`, the app shows the wall instead of the navigator.

**Fail-open:** any error (network, timeout, missing row, malformed version, unknown
platform) → the app boots normally. A backend outage never locks users out.

## Config: `app_min_version` table

One row per platform, seeded on startup (`seedAppMinVersion`, idempotent — it
never overwrites a row you've edited).

| column        | example                                                              |
|---------------|----------------------------------------------------------------------|
| `platform`    | `ios` / `android`                                                    |
| `min_version` | `1.0.0`                                                              |
| `store_url`   | iOS: `https://apps.apple.com/app/id6775085258` · Android: `https://play.google.com/store/apps/details?id=com.juroctech.frontend` |
| `message`     | shown as the wall body (your patch notes)                            |

iOS Apple app id is `6775085258` (permanent — never changes).

## To force an update on a new release

After the new build is live in the stores, bump the floor:

```sql
UPDATE app_min_version
SET min_version = '1.3.0',
    message = 'This version adds X and fixes Y. Please update to continue.'
WHERE platform = 'android';   -- repeat with platform = 'ios'
```

Everyone below `1.3.0` sees the wall on next launch. No backend redeploy, no app rebuild.

> Only bump `min_version` to a version that is **already published** in the store —
> otherwise you block users with no update to install.

## Verify it works (manual, on device/simulator)

1. Backend seeded at `min_version = 1.0.0`, app at `1.0.0` → app boots normally (no wall).
2. `UPDATE app_min_version SET min_version='9.0.0' WHERE platform='android';` →
   relaunch → wall shows, **Update Now** opens the store listing.
3. Stop the backend → relaunch → app still boots (fail-open).
4. Reset: `UPDATE app_min_version SET min_version='1.0.0' WHERE platform='android';`

## Code map

- Endpoint: `server/src/routes/appVersion.ts` → `server/src/controllers/appVersion.ts`
- Version compare: `server/src/utils/versionCompare.ts` (+ tests)
- Model / seed: `server/src/models/appMinVersion.ts`, `server/src/seeds/appMinVersionSeed.ts`
- App gate + wall: `frontend/src/components/UpdateGate.tsx` (mounted in `frontend/app/_layout.tsx`)
- Wall strings: `updateRequiredTitle` / `updateRequiredButton` in `frontend/src/lib/i18n/translations.ts`
