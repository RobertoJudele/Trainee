# Admin Ticket Tabs + User Gym Requests — Design

**Date:** 2026-06-29
**Status:** Approved design, pending implementation plan

## Summary

Two related additions to the existing ticketing (`Issue`) system:

1. **Admin ticket tabs** — replace the single flat admin list with tabs by ticket
   target type, each with an Open/Closed filter.
2. **User gym requests** — let users request that a new gym be added. A gym
   request is modeled as a new ticket type, reviewed manually by an admin who
   then creates the gym through the existing flow.

No new database table, no new API endpoint, no auto-creation logic.

## Background — current system

- **Tickets** = the `Issue` model (`server/src/models/issue.ts`).
  - `targetType`: `trainer | booking | app`
  - `category`: `trainer_behavior | booking_no_show | technical_bug | payment_issue | other`
  - `status`: `open | in_review | resolved | rejected`
  - Has an **unused `metadata` JSONB column** already.
- **User reporting** — `frontend/app/report-issue.tsx` → `POST /issues` (`createIssue`).
- **Admin** — `frontend/app/admin-issues.tsx` shows one flat `FlatList` of all
  issues. The admin API (`GET /issues`) already accepts `?status=`, `?category=`,
  `?targetType=` filters; the UI does not use them.
- **Gyms** — created today only by admins via `POST /gyms`. No user-facing
  "request a gym" path exists.

## Decisions

| Question | Decision |
|----------|----------|
| Gym request model | A **new ticket type** inside the existing `Issue` model (not a separate entity). |
| Admin tabs split on | **targetType** (primary tabs), with an **Open/Closed filter inside each tab**. |
| Approval workflow | **Manual** — the ticket is a heads-up. Admin creates the gym separately and marks the ticket resolved. No auto-create. |
| User-submitted fields | **Name + address + map pin** (captures lat/long). |
| Entry points | **All three:** map screen, gym search / my-gyms, and report-issue screen. |

## Design

### 1. Data model (backend) — reuse `Issue`

Add two enum values in `server/src/types/issue.ts`:

- `IssueTargetType.GYM = "gym"`
- `IssueCategory.GYM_REQUEST = "gym_request"`

A gym request is an `Issue` with:

- `targetType: "gym"`, `category: "gym_request"`
- `title` = gym name
- `description` = address and/or free-text note
- `metadata` (existing JSONB column) = `{ address, city?, latitude, longitude }`
- no `trainerId` / `bookingId`

**Postgres ENUM caveat:** the `issues.target_type` and `issues.category` columns
are Postgres `ENUM` types. New values cannot be added by a plain Sequelize sync —
they require `ALTER TYPE ... ADD VALUE`. During planning, confirm how
`server/src/services/databaseBootstrap.ts` manages schema and add the needed
`ALTER TYPE` step (idempotent: `ADD VALUE IF NOT EXISTS`) so existing databases
pick up the new values.

### 2. Backend request path — reuse existing endpoint

`POST /issues` (`createIssue` in `server/src/controllers/issue.ts`) already accepts
`metadata`. Add one validation branch for `targetType === "gym"`:

- require `metadata.latitude`, `metadata.longitude`, and a gym name
  (`title`, since title = gym name)
- reject `trainerId` / `bookingId`
- the existing duplicate-window guard still applies

No new endpoint. Admin retrieval and status updates use the existing
`GET /issues` and `PATCH /issues/:id/status` unchanged.

> Note: `Issue.title` has a `len: [5, 140]` validator and `description` has
> `len: [10, 2000]`. The request screen must enforce a min gym-name length and
> a non-trivial description (e.g. compose description from the address) so
> submissions pass model validation. Decide exact min lengths in the plan.

### 3. Admin screen — `frontend/app/admin-issues.tsx`

- **Primary tabs by targetType:** Trainer · Booking · App · Gym Requests.
- **Open / Closed segmented filter inside each tab:**
  - Open = `open` + `in_review`
  - Closed = `resolved` + `rejected`
- **Filtering is client-side** on the already-fetched list. Admin ticket volume
  is low, so there is no need to wire the `?targetType=` / `?status=` query
  params yet.
  `ponytail: client-side filter; push to API query params when ticket volume needs it.`
- **Gym-request cards** render the `metadata` (name / address / coordinates) so
  the admin can look the place up. Existing status buttons stay; admin marks the
  ticket resolved manually after creating the gym.
- Other ticket types render as today.

### 4. User request screen — new `frontend/app/request-gym.tsx`

- Fields: **gym name**, **address** (text), **map pin** via `react-native-maps`.
- The pin defaults to the current map region center / user location and captures
  `latitude` / `longitude`.
- Submits via the existing `createIssue` mutation with:
  `targetType: "gym"`, `category: "gym_request"`, `title` = name,
  `description` = address/note, `metadata` = `{ address, city?, latitude, longitude }`.
- On success: confirmation alert, navigate back.

### 5. Entry points → navigate to `request-gym`

- `frontend/app/map.tsx` — "Can't find your gym? Request it" button; passes the
  current region center as the pin default (via route params).
- Gym search / `frontend/app/my-gyms.tsx` — a "Request a gym" action. (Pick the
  one that best fits the existing layout during the plan; search is the
  discovery surface, my-gyms is the trainer surface.)
- `frontend/app/report-issue.tsx` — a "Request a gym" option that routes to the
  new screen (does **not** reuse the issue form; the gym screen has the map
  picker).

### 6. Frontend API types — `frontend/features/support/issueApiSlice.ts`

- Extend the `IssueTargetType` union with `"gym"`.
- Extend the `IssueCategory` union with `"gym_request"`.
- Add `metadata?: Record<string, unknown>` to `CreateIssueRequest` and
  `IssueRecord`.

### 7. i18n — `frontend/src/lib/i18n/translations.ts`

Add EN + RO keys for: the request-gym screen (title, field labels, placeholders,
submit), the entry-point buttons, the admin tab labels (Trainer / Booking / App /
Gym Requests), the Open/Closed filter labels, and the admin gym-request metadata
labels.

## Scope / files touched

**Backend**
- `server/src/types/issue.ts` — add enum values.
- `server/src/controllers/issue.ts` — gym validation branch in `createIssue`.
- `server/src/services/databaseBootstrap.ts` (or a migration) — `ALTER TYPE ... ADD VALUE` for the two enums.

**Frontend**
- `frontend/features/support/issueApiSlice.ts` — type extensions.
- `frontend/app/request-gym.tsx` — **new** screen.
- `frontend/app/admin-issues.tsx` — tabs + Open/Closed filter + gym metadata cards.
- `frontend/app/map.tsx`, `frontend/app/search.tsx` (or `my-gyms.tsx`), `frontend/app/report-issue.tsx` — entry points.
- `frontend/src/lib/i18n/translations.ts` — new keys.

## Out of scope (YAGNI)

- Separate gym-request table/entity.
- Auto-creating the gym on approval / prefilled create-gym form.
- Photo upload on the request.
- Wiring admin filter to server query params.
- Editing/withdrawing a submitted gym request by the user.

## Risks

- **ENUM migration** is the main risk — adding values to a live Postgres enum
  must be done with `ALTER TYPE ... ADD VALUE` and cannot run inside a
  transaction block with other DDL in some PG versions. Verify the bootstrap
  path handles it.
- **Model validators** (`title` min 5, `description` min 10) must be satisfied by
  the request screen's input rules.
