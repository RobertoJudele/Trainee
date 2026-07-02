# Force Update — Design Spec

Date: 2026-07-02

## Goal

Force users onto a minimum app version. When a build older than the configured
minimum launches, show a non-dismissible "Update Required" wall with a
message/patch notes and a button that deep-links to the App Store / Google Play
listing. The minimum version and message are controlled from a database row so
they change without a backend redeploy.

## Non-goals (deliberately excluded)

- Admin UI to edit the config — change it with SQL for now.
- Soft "update available" nudge for newer-but-allowed versions.
- Periodic re-check while the app is running — launch check only.
- Per-request API gating (e.g. 426 on every endpoint).

## Data flow

1. App launches, reads its own version (`Constants.expoConfig.version`) and
   platform (`Platform.OS`).
2. App calls `GET /version/check?platform=<ios|android>&version=<x.y.z>`.
3. Backend loads the row for that platform, compares versions, replies
   `{ updateRequired, message, storeUrl }`.
4. If `updateRequired` is true, the app renders the blocking wall. Otherwise it
   boots normally.

**Fail-open:** if the check errors, times out, or returns an unexpected shape,
the app boots normally. A force-update that fails closed would lock out every
user whenever the backend is down.

## Backend (`server/`)

### Table `app_min_version`

One row per platform.

| column       | type        | notes                              |
|--------------|-------------|------------------------------------|
| `platform`   | text, PK    | `'ios'` or `'android'`             |
| `min_version`| text        | e.g. `"1.2.0"`                     |
| `store_url`  | text        | full listing URL for that platform |
| `message`    | text        | shown on the wall (patch notes)    |
| `updated_at` | timestamptz | `now()` default                    |

Seeded with two rows on bootstrap (follow `databaseBootstrap.ts` /
seed patterns). Initial values:
- `android`: `store_url` = `https://play.google.com/store/apps/details?id=com.juroctech.frontend`, `min_version` = `1.0.0`.
- `ios`: `store_url` = `https://apps.apple.com/app/id6775085258` (Apple app id
  `6775085258`), `min_version` = `1.0.0`.

Bumping the requirement is a plain `UPDATE app_min_version SET min_version=...,
message=... WHERE platform=...`.

### Endpoint `GET /version/check`

- **Auth:** none — must work before login.
- **Query:** `platform` (`ios`|`android`), `version` (semver string).
- **Response:** `{ updateRequired: boolean, message: string, storeUrl: string }`.
- **Comparison:** split both versions on `.`, compare each segment numerically;
  the client is out of date if any earlier segment is lower. Missing segments
  treated as 0. Non-numeric / malformed input → `updateRequired: false` (fail-open).
- **Unknown platform / missing row:** `updateRequired: false`.
- Wired through the existing route → controller → model layering. Mounted in
  `src/routes/index.ts`. Light rate limit consistent with other public routes.

### Version comparison unit check

Leave one runnable check (assert-based) covering: older version → true, equal →
false, newer → false, differing segment lengths (`1.2` vs `1.2.0`), malformed
input → false.

## Frontend (`frontend/`)

### `UpdateGate` component

- Location: mounted in `app/_layout.tsx`, wrapping the `<Stack>` (inside the
  providers so it can use them, above the navigator so the wall covers routes).
- On mount: read `Constants.expoConfig?.version` and `Platform.OS`, call the
  endpoint once.
- **States:**
  - loading / error / `updateRequired: false` → render `children` (fail-open).
  - `updateRequired: true` → render the full-screen wall instead of `children`.
- No new dependency: `expo-constants` and `Linking` are already available.

### The wall

- Full-screen, covers everything, no back gesture / no dismiss.
- Content: title + body message (from the response), an **Update** button.
- Update button → `Linking.openURL(storeUrl)`.
- Static strings ("Update Required", button label) go through existing i18n
  `t()`. The `message` body comes from the DB response as-is.
- Styled with existing `theme` tokens.

### Data call

Small RTK Query endpoint (or a plain `fetch` in the gate — implementer's call,
whichever is lighter given it runs once pre-auth). If RTK Query, add a minimal
`versionApiSlice` following existing slice conventions.

## Acceptance

- Fresh build whose version < DB min shows the wall; Update button opens the
  correct store listing.
- Build whose version >= DB min boots normally.
- Backend unreachable → app boots normally (fail-open verified).
- Changing `min_version` / `message` via SQL takes effect on next app launch
  with no redeploy.
