# RFC: Unify the "active trainer" rule behind one deep module

## Summary

The single business rule *"is this trainer's subscription active?"* is currently
implemented in **four** places that have already diverged. This RFC consolidates
them behind one truth (`resolveEntitlement`) plus one SQL mirror exposed as a
`Trainer.scope("active")` model scope, deletes the duplications, fixes two live
bugs found along the way, and locks the two executable forms together with a
parity test.

## Background — the four copies

1. **Canonical truth (per-row, pure):** `server/src/services/billing/domain.ts:19`
   — `resolveEntitlement(state, {isRevenueCatOnly, clock}): Entitlement`.
2. **Service wrapper:** `server/src/services/billing/BillingService.ts:56`
   — `getEntitlement(userId)` wraps #1. Used correctly by
   `server/src/middleware/subscription.ts:18`.
3. **Hand re-implementation of #2:** `server/src/controllers/trainer.ts:51-71`
   (`trainerToBillingState` + `resolveTrainerEntitlement`) bypasses the service.
4. **Hand-rolled SQL filter:** `server/src/controllers/trainer.ts:852` (search)
   and `server/src/controllers/recommendation.ts:93` (suggest):
   ```js
   { [Op.or]: [
     { subscriptionStatus: ACTIVE },
     { subscriptionStatus: TRIAL, trialEndsAt: { [Op.gt]: now } },
   ]}
   ```

## Bugs this causes (both live today)

**Bug 1 — the SQL filter is a weaker, divergent predicate than the truth.**
It keys only on `subscriptionStatus` and ignores `iapExpiresAt`,
`currentPeriodEndsAt`, `billingProvider`, and `isRevenueCatOnly`. Consequences:
- An IAP trainer whose `iapExpiresAt` has lapsed but whose row still reads
  `ACTIVE` is **shown in search/suggest** when `resolveEntitlement` says inactive.
- Default `BILLING_MODE` is `revenuecat_only` (`config/billingMode.ts:13`), so a
  Stripe trainer with `subscriptionStatus=ACTIVE` is **inactive** per
  `resolveEntitlement` (`domain.ts:82-90`) but the SQL filter **still lists them**.
- Any future edit to `resolveEntitlement` silently does **not** propagate to
  search/suggest.

**Bug 2 — `Op.or` key collision silently drops the subscription filter in search.**
In `searchTrainers` the subscription `Op.or` at `trainer.ts:852` is **overwritten**
by the bio text-search `Op.or` when a query `q` is present (`trainer.ts:~950`), and
the `trainersByBio` id-gathering query (`trainer.ts:~1028`) then runs with that
clobbered `where` — so **bio search returns inactive trainers**. The subscription
filter is manually re-pasted onto `finalTrainerWhere` at `trainer.ts:~1063-1069`
(a third copy) to partially compensate.

## Proposal (hybrid: model scope spine + per-row cleanup)

### 1. One SQL mirror of the rule, in the billing module
New `server/src/services/billing/activeSubscriptionScope.ts` exporting:
```ts
export function activeSubscriptionWhere(
  opts: { isRevenueCatOnly?: boolean; clock?: Clock } = {},
): WhereOptions;
```
It is the `isActive === true` subset of `resolveEntitlement`, branch-for-branch:
- `TRIAL` with `trialEndsAt > now`
- `ACTIVE` + provider ∈ {APPLE, GOOGLE} + `iapExpiresAt > now`
- `ACTIVE` + provider STRIPE + (`currentPeriodEndsAt > now` OR `currentPeriodEndsAt IS NULL`), **only when not `isRevenueCatOnly`**

Defaults: `clock` → `SystemClock`, `isRevenueCatOnly` → `isRevenueCatOnlyMode()`
(same two knobs `resolveEntitlement` takes). It lives in `services/billing`
(not the pure `domain.ts`) because it imports `sequelize`; it imports only
billing types, **not** the `Trainer` model, to avoid a cycle.

**Critically, it nests its `Op.or` under `Op.and`** so it can never collide with a
caller's own `Op.or` (fixes Bug 2 structurally):
```ts
return { [Op.and]: [{ [Op.or]: branches }] };
```

### 2. Expose it as a named model scope
In `server/src/models/trainer.ts`, register a **function scope** (evaluated per
query so `now` is always fresh):
```ts
@Scopes(() => ({ active: () => ({ where: activeSubscriptionWhere() }) }))
```
The entire caller-facing API becomes `Trainer.scope("active").findAll(opts)`.

### 3. Delete the duplications
- `searchTrainers` (`trainer.ts`): remove the hand-built subscription `Op.or`
  (all three copies), add `.scope("active")` to the listing/id-gathering/count
  queries. Bug 2's re-paste block deletes outright.
- `suggestTrainers` (`recommendation.ts:91`): drop the `where` `Op.or`, use
  `Trainer.scope("active").findAll(...)`.
- Per-row cleanup (from the "minimal" design's discipline): delete
  `trainerToBillingState` / `resolveTrainerEntitlement` at `trainer.ts:51-71`;
  reuse a single shared `toBillingState(trainer)` (export the one already in the
  Sequelize billing-state repo) and call `resolveEntitlement` directly, or route
  through `BillingService.getEntitlement`.
- `middleware/subscription.ts`: **unchanged** (already the correct path).

### 4. Lock the two forms together — parity test
`resolveEntitlement` remains the declared source of truth; the SQL form is a
mirror. Add `server/src/tests/activeSubscription.parity.test.ts`:
- Enumerate a `BillingState` matrix: every `billingProvider` × every
  `subscriptionStatus` × {`trialEndsAt`, `iapExpiresAt`, `currentPeriodEndsAt`}
  ∈ {past, future, null} × `isRevenueCatOnly` ∈ {true, false}.
- Truth set = rows where `resolveEntitlement(row, opts).isActive === true`.
- Load the same rows into the `Trainer` model and query with
  `Trainer.scope("active")`; assert the returned id set === the truth set, for
  both `isRevenueCatOnly` values.
- Run against the real Sequelize/pg dialect used by the existing test suite (the
  parity test must exercise real operator translation, e.g. `Op.is: null`).

Any new branch added to `resolveEntitlement` but not the SQL mirror (or vice
versa) fails this test naming the exact `(provider, status, dates)` combo.

### 5. Regression guard
Add an ESLint `no-restricted-syntax` (or a grep-based test) banning the literal
`subscriptionStatus: subStatus.TRIAL` inside a `where` **outside**
`activeSubscriptionScope.ts`, so re-introducing the hand-rolled filter fails CI.

## Explicitly out of scope (YAGNI)

- The `Expr`-AST / rule-table / `EntitlementQuery` compiler (the "flexible"
  design). Its extras — `expiringWithin`, per-state admin counts, one-line new
  providers — are only worth ~250 LOC of interpreter when a **second provider or
  an expiring-soon query is an actual ticket**. Until then the two-form + parity
  test approach is the same foundation and can grow into it later.
- Making `active` the `defaultScope` — silently filters admin/write/entitlement
  lookups and forces `.unscoped()` sprinkling; a subtler footgun. Named scope
  keeps surprise at zero.
- A partial index on `(subscriptionStatus, currentPeriodEndsAt)` — named upgrade
  path if listing under load shows the predicate is hot.

## Acceptance criteria

- [ ] `searchTrainers` and `suggestTrainers` list only trainers for whom
      `resolveEntitlement(...).isActive` is true, in every mode.
- [ ] Bio/text search no longer returns inactive trainers (Bug 2 fixed).
- [ ] Stripe-active trainers are excluded from listings when
      `BILLING_MODE=revenuecat_only`; expired-IAP trainers are excluded (Bug 1).
- [ ] The `trainer.ts:51-71` hand mapper is deleted; one `toBillingState` remains.
- [ ] Parity test passes over the full state matrix for both `isRevenueCatOnly`
      values; regression guard is in place.
- [ ] `middleware/subscription.ts` behavior unchanged.

## Files touched

- New: `server/src/services/billing/activeSubscriptionScope.ts`,
  `server/src/tests/activeSubscription.parity.test.ts`
- Modified: `server/src/models/trainer.ts` (register scope),
  `server/src/controllers/trainer.ts` (delete duplications, use scope),
  `server/src/controllers/recommendation.ts` (use scope)
- Reference (unchanged truth): `server/src/services/billing/domain.ts`,
  `server/src/middleware/subscription.ts`

---
*Generated from an improve-codebase-architecture deep-module design session
(3 competing interfaces: minimal / flexible / common-case). This is the
recommended hybrid.*
