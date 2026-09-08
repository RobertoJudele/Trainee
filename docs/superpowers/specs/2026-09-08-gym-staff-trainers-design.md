# Gym staff trainers — design

**Date:** 2026-09-08 · **Status:** approved, pending implementation plan

## Context

Tapping a gym pin on the map opens a bottom sheet listing every trainer linked to
that gym. Today that list has no order at all — `getGymById` issues its query with
no `ORDER BY`, so the sequence is whatever Postgres returns, roughly insertion
order. A gym's own employed trainers appear wherever they happen to land, mixed
into the freelancers who merely listed the gym as a place they work.

We want a gym's staff to appear at the top of its pin, in their own labelled
section.

The product deliberately has **no gym accounts** — gyms are Google Places data,
not users (`docs/marketing/brief-produs-factual.md` §2). Nobody can currently
assert "this trainer works for us", so the affiliation and the authority to grant
it both have to be introduced.

This matters commercially: trainers pay for visibility, and "staff" is a free
placement boost above paying subscribers. That is why the grant is reviewed rather
than self-served.

## Decisions

| Question | Decision |
|---|---|
| What is a gym's "own" trainer? | Employed staff, distinct from independents who list the gym as a workplace |
| Who may assert it? | The trainer requests; an admin approves. Never self-granted |
| How is it shown? | Two labelled sections — "Antrenorii sălii" above "Alți antrenori aici" |
| Lapsed subscribers on pins? | Fixed in this change — pins adopt the same active-subscription filter as search |

## Non-goals

- Gym accounts, gym login, or gyms managing their own listing. Out of scope by
  design; if it ever ships, it replaces the admin as the approving authority.
- Verifying employment against any real-world record. An admin approval is a
  human judgement, not proof.
- Changing how trainers join a gym (`joinGym`) or the per-gym `isAvailable`
  toggle. Staff status is orthogonal to both.
- Any change to trainer search ranking. This affects gym pins only.

## Schema

Four columns on `trainer_gyms`, in `server/src/models/trainerGym.ts` and mirrored
in `TrainerGymAttributes` (`server/src/types/gym.ts:41-54`):

```
staffStatus       'none' | 'pending' | 'approved' | 'rejected'   NOT NULL default 'none'
staffRequestedAt  Date | null
staffReviewedAt   Date | null
staffReviewedBy   number | null   → FK users.id, ON DELETE SET NULL
```

A discriminated union rather than a boolean pair, per the project's TypeScript
conventions — it makes the illegal states (approved-but-never-requested)
unrepresentable.

The join row *is* the affiliation, so its lifecycle belongs on that row. Leaving a
gym deletes the row and the affiliation with it; no orphan cleanup is needed, and
re-joining correctly starts over at `none`.

### Migration

`server/migrations/004_add_trainer_gym_staff.sql`, following the conventions of
001–003: header comment explaining why it is manual, the psql invocation for local
and prod, and idempotent statements (`ADD COLUMN IF NOT EXISTS`).

**This is not optional.** The server boots with `sequelize.sync({ alter: false })`
(`server/src/db.ts:48`), so new columns are *not* created on an existing database.
The migration must run once per environment before the build that uses it, or
every gym query starts erroring on a missing column.

Include a partial index, since the read path only ever filters for approved rows:

```sql
CREATE INDEX IF NOT EXISTS trainer_gyms_gym_staff_idx
  ON trainer_gyms (gym_id) WHERE staff_status = 'approved';
```

## API

Three endpoints in `server/src/controllers/gym.ts`, routed in
`server/src/routes/gym.ts`:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/gyms/:gymId/staff-request` | `authenticate` + `subscription` | Trainer requests staff status. Sets `pending`, stamps `staffRequestedAt` |
| `PATCH` | `/gyms/:gymId/staff-request/:trainerId` | `authenticate` + `requireAdmin` | `{ approve: boolean }` → `approved` / `rejected`, stamps reviewer and time |
| `GET` | `/gyms/staff-requests` | `authenticate` + `requireAdmin` | Pending queue, with trainer and gym names |

Follow the existing route conventions: the trainer routes sit alongside
`/:gymId/join` and carry `subscription` middleware; validators go in
`server/src/middleware/validation.ts` next to `gymAvailabilityValidation`, with
`handleValidationErrors` after them.

**Route order matters.** `/gyms/staff-requests` must be registered *before*
`/gyms/:gymId`, or Express matches it as `gymId = "staff-requests"` and the
validator rejects it as a non-numeric id. `server/src/routes/gym.ts` already
carries this hazard and its warning on `/my-gyms` — put the new route beside it.

Rules:

- A request requires an existing `TrainerGym` row — you cannot claim staff status
  at a gym you have not joined.
- Only `none` and `rejected` may transition to `pending`. Re-requesting after a
  rejection is allowed; requesting while already `pending` or `approved` is a
  no-op, not an error.
- Approval is idempotent.
- All mutations call `invalidateGymCache()`, which the join/leave/availability
  handlers already do.

## Ordering and rendering

**Server.** `getGymById` (`server/src/controllers/gym.ts:147-205`) adds
`staffStatus` to the selected `TrainerGym` attributes and gains an explicit order:

```ts
order: [[{ model: Trainer, as: "trainer" }, "rankingScore", "DESC"]]
```

`Trainer.rankingScore` is the Bayesian-shrunk rating maintained by
`Review.updateTrainerRating` (`server/src/models/review.ts:99`, prior in
`server/src/utils/rating.ts`) and is what `searchTrainers` already sorts by
default. Reusing it keeps pin order consistent with search and fixes the
undefined-order bug independently of the staff feature.

Grouping is **not** encoded in SQL. The response stays one rating-sorted array and
the client partitions it — no fragile `CASE` expression, and the section split
lives where the section headers do.

**Client.** `frontend/features/gym/gymApiSlice.ts` adds `staffStatus` to
`GymTrainer` (lines 20-36). In `frontend/app/map.tsx`, a `useMemo` partitions
`gymTrainers` on `staffStatus === "approved"`, and the block at lines 1309-1327
renders two headers instead of one, each with the existing count badge.

`renderTrainerRow` (lines 954-1032) is untouched. When there are no staff, the
staff section is omitted entirely and the sheet is byte-identical to today's,
including the `noTrainersHere` empty state.

**`pending` is invisible to clients.** It affects neither ordering nor rendering;
only the requesting trainer sees it, in `my-gyms.tsx`.

## Trainer and admin surfaces

**`frontend/app/my-gyms.tsx`** — each joined gym card gains a "Lucrez pentru
această sală" action beside the existing availability `Switch` (line 163), showing
the request's current state: absent when `approved`, disabled with a "în
așteptare" label when `pending`, actionable when `none` or `rejected`.

**`frontend/app/admin-issues.tsx`** — a new section fed by `GET
/admin/staff-requests`, reusing the screen's existing `FlatList` and filter-chip
patterns (lines 111-161) rather than adding a screen. The chips already model
open-vs-closed; pending-vs-reviewed is the same shape.

## Subscription fix

Included in this change at the user's direction; adjacent to the feature but not
caused by it.

`getGymById` includes the bare `Trainer` model, so it never applies
`Trainer.scope("active")` — unlike `searchTrainers`
(`server/src/controllers/trainer.ts:1153`) and recommendations
(`server/src/controllers/recommendation.ts:91`). Trainers with lapsed
subscriptions are therefore hidden from search but still visible on gym pins.

Left alone, staff ordering would make this worse: a lapsed staff trainer would get
top billing on the pin while paying independents sat below them.

The fix is to scope the include, with `required: true` so a lapsed trainer removes
the row rather than yielding a null trainer:

```ts
include: [{ model: Trainer.scope("active"), as: "trainer", required: true, ... }]
```

It must go through the scope helper, not a hand-rolled `where` —
`server/src/tests/noHandRolledSubscriptionFilter.test.ts` fails the build if the
active-subscription rule is expressed anywhere except
`services/billing/activeSubscriptionScope.ts`.

**`getAllGyms` must be fixed in the same change.** Its `availableTrainerCount`
(lines 106-116) counts `TrainerGym` rows with the same missing filter, so fixing
only the sheet would leave a pin badge reading "5" above a list of three. Add the
same scoped include with `attributes: []`.

Accepted consequences:

- Trainers visible on pins today disappear when their subscription lapses —
  including founding-grant holders as their three months expire from December
  2026. This is the same treatment search already gives them.
- An approved staff trainer without an active subscription is hidden entirely,
  not merely demoted. Staff status is a ranking signal, not an entitlement.
- The 30s `gymBulkCache` is not invalidated by a lapse, so a count can be stale
  for up to 30 seconds. Self-healing; not worth wiring up.

## i18n

New RO + EN keys in `frontend/src/lib/i18n/translations.ts`: `gymStaffTrainers`
("Antrenorii sălii"), `otherTrainersHere` ("Alți antrenori aici"),
`workForThisGym`, `staffRequestPending`, plus admin-queue strings. Existing
`trainersHere` is retained for the no-staff case.

Romanian is the default language and addresses the user as *tu*
(`.agents/product-marketing.md`, Brand Voice). Terminology follows
`docs/marketing/brief-produs-factual.md` §6 — "sală", "antrenor", never
"platformă".

## Testing

Extend `server/src/tests/gym.test.ts`:

- A non-admin calling the review endpoint is rejected.
- A staff request without an existing `TrainerGym` row is rejected.
- `pending` neither reorders nor appears as staff in the response.
- Approval marks the trainer `approved` in `getGymById`'s payload.
- Leaving the gym drops the affiliation; rejoining starts at `none`.
- A lapsed-subscription trainer is absent from both `getGymById` and the
  `availableTrainerCount` in `getAllGyms`.

`noHandRolledSubscriptionFilter.test.ts` and
`activeSubscription.parity.test.ts` must keep passing untouched.

Frontend: `npx tsc --noEmit` in `frontend/`.

## Risks

- **The migration is manual.** Deploying the server build before running
  `004_*.sql` breaks every gym query. Run the migration first, in every
  environment.
- **Approval is a human judgement.** Nothing stops a trainer from claiming staff
  status at a gym they do not work for; the admin is the only check. At the
  current scale — one admin, ~30 trainers in Cluj — this is adequate. It does not
  survive a second city, and the queue is the thing to watch.
- **The subscription fix is user-visible.** Trainers vanish from pins the moment
  their subscription lapses. Expect a support question the first time a founding
  grant expires.
