# Poster QR scan counter + trainer landing page

**Date:** 2026-09-18
**Status:** approved, ready for planning

## Problem

Printed posters go up in gyms to recruit personal trainers. Each poster carries a
QR code. Scanning it must (a) increment a per-gym counter in the backend, so print
spend can follow the gyms that work, and (b) land the trainer on a Romanian
recruitment page pitched at them, not at clients.

## Scope decisions

Settled during brainstorming; recorded here because each closed off a plausible
alternative.

| Decision | Chosen | Rejected |
|---|---|---|
| Counting granularity | One code per gym | Per individual poster; per campaign |
| Gym linkage | Optional `gym_id` + required free-text `label` | Required FK; label only |
| Storage shape | Counter columns only, incremented in place | Event-row table + denormalized counters |
| Attribution depth | Scans + CTA (store) clicks | Signup attribution (would touch the app) |
| Management | Admin API endpoints | In-app admin screen; manual SQL |

**The counters-only choice is deliberate and its cost is known.** There is no
event log, so there is no history: "scans last week", "did the second batch move
the needle", and "how many were the same person" are permanently unanswerable, and
the data to answer them later is never recorded. `last_scanned_at` is the one
concession — it distinguishes a dead poster from a live one for the price of a
single column written in the same `UPDATE` as the increment.

## Data model

New table `poster_codes`, one row per gym poster. Model at
`src/models/posterCode.ts`, registered in the `models` array in `src/db.ts`.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK autoincrement | |
| `code` | STRING(32), NOT NULL, UNIQUE, indexed | Token in the QR URL |
| `label` | STRING(120), NOT NULL | Free-text gym name; works with no `gyms` row |
| `gym_id` | INTEGER, NULL, FK -> `gyms` | Set when the gym exists |
| `gym_logo_url` | STRING(500), NULL | Per-poster logo for the trust lockup |
| `scan_count` | INTEGER, NOT NULL, default 0 | |
| `apple_click_count` | INTEGER, NOT NULL, default 0 | |
| `play_click_count` | INTEGER, NOT NULL, default 0 | |
| `last_scanned_at` | TIMESTAMP, NULL | |
| `is_active` | BOOLEAN, NOT NULL, default true | Retire without losing counts |
| `created_at` / `updated_at` | TIMESTAMP | Sequelize-managed |

Store clicks are split by platform rather than pooled into one column: it costs one
extra integer and reveals the iOS/Android mix per gym, which nothing else measures.

**Migration required.** `src/index.ts:109` boots with `sequelize.sync({ alter: false })`,
which does not create a new model's table on an existing database — see the header
comment in `migrations/003_add_app_release_notes.sql`. Add
`migrations/005_add_poster_codes.sql` as `CREATE TABLE IF NOT EXISTS`, idempotent,
following 003's header-comment style (why the file exists, local and prod psql
invocations).

## Public endpoints

Both unauthenticated and HTML-serving, mounted on the main router in
`src/routes/index.ts` beside `GET /t/:slug`, for the same stated reason: browsers
and crawlers fetch them, and they must survive changes to the JSON API surface.

### `GET /p/:code`

1. Look up the code where `is_active = true`. Unknown or retired -> `renderNotFound()`
   at HTTP 404 (reuse the export from `publicProfilePage.ts`).
2. Unless suppressed (below), atomically
   `UPDATE poster_codes SET scan_count = scan_count + 1, last_scanned_at = now()`.
   Use Sequelize `increment()`, which emits `SET x = x + 1` — no read-modify-write
   race when two people scan simultaneously.
3. Render the landing page.

The path segment carries the code rather than a query parameter (`?gym=`, which the
design handoff suggests as one option). A query string is trivially editable by a
visitor and would let one URL serve every poster, which defeats per-gym counting.
A short path also produces a denser, more scannable QR.

### `GET /p/:code/start`

The single CTA target. Reads the user-agent, increments `apple_click_count` for iOS
or `play_click_count` for Android, and 302s to the matching store listing. An
unrecognised user-agent (desktop) increments neither and redirects to the Play
listing. Unknown or retired code redirects to the Play listing rather than erroring:
someone standing in a gym should never meet an error page.

Store URLs come from the same constants/env vars `controllers/publicProfile.ts`
already uses (`DEFAULT_APPLE_STORE_URL`, `DEFAULT_PLAY_STORE_URL`,
`PUBLIC_APPLE_STORE_URL`, `PUBLIC_PLAY_STORE_URL`).

### What must not be counted

Each of these silently inflates every number otherwise.

1. **HEAD requests.** Express matches `GET` handlers for HEAD, so a link checker
   would double every scan. Skip the increment when `req.method === "HEAD"`.
2. **Link-preview crawlers.** The first time a poster URL is shared in WhatsApp or
   Messenger, the unfurler fetches it. Match a user-agent list —
   `facebookexternalhit`, `WhatsApp`, `Twitterbot`, `TelegramBot`, `Discordbot`,
   `Slackbot`, `bingbot`, `Googlebot` — and serve the page without counting. The
   page also carries `<meta name="robots" content="noindex">`.
3. **Flood protection, deliberately loose.** A dedicated limiter of roughly 120
   hits/minute per IP that, when exceeded, still serves the page and only skips the
   increment. It must NOT reuse `publicReadRateLimit`: a gym NATs every member
   behind one IP, so a normal limiter would refuse real scanners and undercount
   exactly the posters performing best.

## Landing page

New `src/services/posterLandingPage.ts` — a pure function returning an HTML string,
mirroring `publicProfilePage.ts` and reusing its exported `esc()` and `safeUrl()`.

Visual spec is `design_handoff_salvio_trainer_landing/README.md`, high fidelity,
recreated rather than ported (its streaming-component runtime `support.js` is
explicitly not to be carried over). Four stacked blocks: hero on `--ink-900`, green
offer card, action block on canvas, trust block.

**Assets and styling**
- Copy the token CSS verbatim from
  `design_handoff_salvio_trainer_landing/design_files/_ds/salvio-design-system-*/tokens/`
  (7.4 KB total) into an inline `<style>` block. Inline rather than served: the
  server has no static-asset infrastructure today and `publicProfilePage.ts`
  inlines its CSS the same way. Prefer `var(--token)` over literal hex.
- Fonts (Archivo, Manrope, IBM Plex Mono) from Google Fonts.
- The four Lucide icons (`chevron-right`, `map-pin`, `tag`, `badge-check`) as
  inline SVG paths, not a JS library.
- `assets/salvio-logo.png` is 730 KB and renders at 32 px. Downscale to 64×64 (2×),
  commit the small file, and inline it as a base64 data URI — avoids inventing a
  static route for one image.

**Gym name.** From `label`, or the joined `gyms.name` when `gym_id` is set. When
absent or unknown, fall back to the gym-neutral headline "Ești antrenor în
București?" — never render the raw `[Nume Sală]` placeholder. Escape through
`esc()`; it lands inside an `<h1>`. Per the handoff, step the headline from 44px to
38px (`--text-3xl`) when a long name would wrap to four lines at 360px, rather than
truncating.

**Countdown.** Deadline and month count come from the `billingService` singleton exported by
`src/services/billing/container.ts` — `billingService.getFoundingGrantOffer()`, the same call
`controllers/billing.ts:88` serves to the app. It returns `{ isOpen, months, deadline }`
synchronously from config with no DB access. Do not hardcode the
`2026-09-30T23:59:59+03:00` literal in the handoff: sourcing both from the service
means the poster page and the in-app founding-offer banner can never disagree, and
moving the deadline is a config change.
- Server-renders the first frame into the markup so the block never flashes empty.
- A small inline script ticks every 1000 ms, format `Dz HH:MM` (days unpadded, hours
  and minutes zero-padded), computed from the fixed ISO deadline with its explicit
  offset, never from the visitor's local clock. Seconds are deliberately not shown.
- When `isOpen` is false, omit the offer card entirely rather than rendering
  "Închis" on a poster still hanging on a wall.

**Copy changes from the handoff** (approved 2026-09-18):
- Remove `Parteneriat oficial · Bucureşti` from the trust lockup. It claims an
  agreement with a gym whose wall the poster hangs on.
- Remove `Locuri limitate` from the bottom row.
- Consequently, the trust lockup's second line becomes the gym name in the same IBM
  Plex Mono 600 / 11px / uppercase / `letter-spacing:0.08em` style, falling back to
  `BUCUREŞTI` when there is no gym name, so the card keeps its two-line rhythm.
- Consequently, the bottom row holds only the Instagram link, left-aligned.
- `OFERTA PENTRU PRIMII MEMBRII` is kept as-is, a deliberate decision: it implies a
  cap that `getFoundingGrantOffer()`'s comment says does not exist, and was reviewed
  and retained.
- Proof row 1 keeps the client's copy verbatim including its missing diacritics
  ("salile", "singuri"), per the handoff's instruction not to silently correct it.

**Gym logo slot.** Rendered from `gym_logo_url` at 36×36, `border-radius:9px`,
between the divider and the text column; the slot is omitted entirely when the
column is null.

## Admin API

`src/routes/posterCodes.ts`, mounted at `/poster-codes` in `src/routes/index.ts`,
behind `authenticate` + `requireAdmin` (the pattern `routes/issue.ts` uses).
Validators added to `src/middleware/validation.ts` in the existing express-validator
style. Controller at `src/controllers/posterCodes.ts`.

- `POST /poster-codes` — body `{ label, gymId?, code?, gymLogoUrl? }`. Generates a
  6-character code from an unambiguous lowercase alphabet (no `0`/`o`, `1`/`l`/`i`)
  when none is supplied; a supplied code must match `^[a-z0-9-]{3,32}$` and be
  unique. Responds 201 with the row plus the full QR URL, built on
  `publicWebBaseUrl()` from `src/utils/publicUrl.ts`, to paste into any QR
  generator. No QR image generation in this version.
- `GET /poster-codes` — every code with its three counters and `last_scanned_at`,
  ordered by `scan_count` descending.
- `PATCH /poster-codes/:id` — body `{ label?, isActive?, gymLogoUrl? }`, to rename,
  retire, or attach a logo.

## Testing

`src/tests/posterCode.test.ts`, supertest against `app`, following the existing
route tests:

- A scan increments `scan_count` and sets `last_scanned_at`.
- A HEAD request to the same URL does not increment.
- A `facebookexternalhit` user-agent is served the page but does not increment.
- An unknown code and a retired (`is_active = false`) code both 404.
- `/start` with an iOS user-agent increments `apple_click_count` only and 302s to
  the Apple listing; an Android user-agent increments `play_click_count` only and
  302s to Play; a desktop user-agent increments neither and 302s to Play.
- All three admin routes return 403 for a non-admin user.
- A gym label containing `<` renders escaped in the headline.

## Out of scope

Signup attribution (which scans became trainers), QR image generation, an in-app
admin screen, any frontend change, and any time-series reporting.
