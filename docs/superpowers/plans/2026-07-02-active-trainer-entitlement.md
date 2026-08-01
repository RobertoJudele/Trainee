# Unify "Active Trainer" Entitlement Rule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the four divergent implementations of "is this trainer's subscription active?" into one truth (`resolveEntitlement`) plus one SQL mirror exposed as `Trainer.scope("active")`, deleting the duplications and fixing two live bugs.

**Architecture:** `resolveEntitlement` (pure, per-row) stays the single source of truth. A new `activeSubscriptionWhere()` builder produces the `isActive===true` subset as a Sequelize `WhereOptions`, nested under `Op.and` so it can never collide with a caller's `Op.or`. It's registered as a named `active` scope on the `Trainer` model. Search and suggest call `.scope("active")`; the per-row mapper duplication is removed; a parity test locks the SQL form to `resolveEntitlement`.

**Tech Stack:** Node.js + Express + sequelize-typescript + PostgreSQL + Jest (ts-jest). Tests are DB-backed integration tests (`src/tests/setup.ts` runs `sequelize.sync({force:true})` against a real Postgres and closes the connection in a global `afterAll`).

## Global Constraints

- `resolveEntitlement` (`src/services/billing/domain.ts:19`) remains the declared source of truth. The SQL form mirrors it; it never becomes a second author of the rule.
- The SQL builder MUST nest its `Op.or` under `Op.and`: `{ [Op.and]: [{ [Op.or]: branches }] }` — this is what fixes the `Op.or` collision bug structurally.
- The builder MUST honor `isRevenueCatOnly`: drop the Stripe branch entirely when true.
- `now` MUST be injectable (default `new Date()`) so the parity test is deterministic.
- Use a **named** scope (`active`), NOT `defaultScope` — a default scope would silently filter admin/write/entitlement lookups.
- `middleware/subscription.ts` is already correct — do NOT touch it.
- Do NOT build the `Expr`/rule-table compiler (YAGNI until a second provider or expiring-soon query is a real ticket).
- Enum values (from `src/types/trainer.ts`): `subStatus` = `TRIAL='trial'`, `ACTIVE='active'`, `PAST='past_due'`, `CANCELED='canceled'`; `BillingProvider` = `NONE='none'`, `STRIPE='stripe'`, `APPLE='apple'`, `GOOGLE='google'`.
- Run tests with the local Jest binary; from `C:\dev\Trainee\server` use `npx jest <path>`. Typecheck with `node ./node_modules/typescript/bin/tsc --noEmit` from the `server` dir (project `npx tsc` resolves the wrong package).
- Parity/integration tests must NOT call `sequelize.close()` — the global `afterAll` in `src/tests/setup.ts` owns that.

## File Structure

- **New** `src/services/billing/trainerBillingState.ts` — `toBillingState(trainer): BillingState` mapper (single copy of the Trainer→BillingState mapping currently duplicated in the repo and the controller).
- **New** `src/services/billing/activeSubscriptionScope.ts` — `activeSubscriptionWhere(opts): WhereOptions` (SQL mirror of `resolveEntitlement`'s active subset).
- **Modify** `src/models/trainer.ts` — register the `active` scope.
- **Modify** `src/services/billing/adapters/SequelizeBillingStateRepo.ts` — use shared `toBillingState`, delete private `toState`.
- **Modify** `src/controllers/trainer.ts` — use shared `toBillingState`; delete both hand-rolled subscription filters; apply `.scope("active")`.
- **Modify** `src/controllers/recommendation.ts` — apply `.scope("active")`.
- **New** `src/tests/activeSubscription.parity.test.ts` — parity + collision-merge tests.
- **New** `src/tests/noHandRolledSubscriptionFilter.test.ts` — regression guard.

---

### Task 1: Extract the shared `toBillingState` mapper

Removes the duplicated Trainer→BillingState mapping (copies #2 and #3 from the RFC). The mapping currently exists as a private `toState` in `SequelizeBillingStateRepo.ts:35-51` and verbatim as `trainerToBillingState` in `trainer.ts:51-65`.

**Files:**
- Create: `server/src/services/billing/trainerBillingState.ts`
- Test: `server/src/tests/trainerBillingState.test.ts`
- Modify: `server/src/services/billing/adapters/SequelizeBillingStateRepo.ts`
- Modify: `server/src/controllers/trainer.ts:51-71`

**Interfaces:**
- Consumes: `Trainer` model, `BillingState`/`BillingProvider`/`subStatus` from billing types.
- Produces: `toBillingState(trainer: Trainer): BillingState`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/trainerBillingState.test.ts
import { describe, it, expect } from "@jest/globals";
import { toBillingState } from "../services/billing/trainerBillingState";
import { BillingProvider, subStatus } from "../services/billing/types";

describe("toBillingState", () => {
  it("maps trainer billing columns onto a BillingState", () => {
    const trialEnds = new Date("2030-01-01T00:00:00Z");
    const trainer: any = {
      id: 7,
      userId: 42,
      billingProvider: BillingProvider.APPLE,
      subscriptionStatus: subStatus.ACTIVE,
      iapExpiresAt: trialEnds,
    };
    const state = toBillingState(trainer);
    expect(state.trainerId).toBe(7);
    expect(state.userId).toBe(42);
    expect(state.billingProvider).toBe(BillingProvider.APPLE);
    expect(state.subscriptionStatus).toBe(subStatus.ACTIVE);
    expect(state.iapExpiresAt).toBe(trialEnds);
  });

  it("defaults missing provider/status to NONE/CANCELED and blanks to undefined", () => {
    const state = toBillingState({ id: 1, userId: 2 } as any);
    expect(state.billingProvider).toBe(BillingProvider.NONE);
    expect(state.subscriptionStatus).toBe(subStatus.CANCELED);
    expect(state.stripeCustomerId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\dev\Trainee\server && npx jest src/tests/trainerBillingState.test.ts`
Expected: FAIL — `Cannot find module '../services/billing/trainerBillingState'`.

- [ ] **Step 3: Create the mapper**

```ts
// server/src/services/billing/trainerBillingState.ts
import type { Trainer } from "../../models/trainer";
import { BillingProvider, BillingState, subStatus } from "./types";

// Single source for mapping a Trainer row to the pure BillingState the billing
// domain understands. Previously duplicated in SequelizeBillingStateRepo and
// the trainer controller.
export function toBillingState(trainer: Trainer): BillingState {
  return {
    trainerId: trainer.id,
    userId: trainer.userId,
    billingProvider: (trainer.billingProvider as BillingProvider) || BillingProvider.NONE,
    subscriptionStatus: (trainer.subscriptionStatus as subStatus) || subStatus.CANCELED,
    stripeCustomerId: trainer.stripeCustomerId || undefined,
    stripeSubscriptionId: trainer.stripeSubscriptionId || undefined,
    trialEndsAt: trainer.trialEndsAt || undefined,
    currentPeriodEndsAt: trainer.currentPeriodEndsAt || undefined,
    iapProductId: trainer.iapProductId || undefined,
    iapExpiresAt: trainer.iapExpiresAt || undefined,
    iapLastVerifiedAt: trainer.iapLastVerifiedAt || undefined,
    appleOriginalTransactionId: trainer.appleOriginalTransactionId || undefined,
    googlePurchaseToken: trainer.googlePurchaseToken || undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\dev\Trainee\server && npx jest src/tests/trainerBillingState.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewire `SequelizeBillingStateRepo` to use the shared mapper**

In `server/src/services/billing/adapters/SequelizeBillingStateRepo.ts`:
- Add import at top: `import { toBillingState } from "../trainerBillingState";`
- Replace both `this.toState(trainer)` calls (lines 8 and 13) with `toBillingState(trainer)`.
- Delete the entire private `toState(...)` method (lines 35-51).
- Remove now-unused imports if any (`BillingProvider`, `subStatus` may still be used elsewhere in the file — only remove if unused).

- [ ] **Step 6: Rewire the trainer controller to use the shared mapper**

In `server/src/controllers/trainer.ts`, replace the block at lines 51-71:

```ts
const trainerToBillingState = (trainer: Trainer): BillingState => ({
  // ...15 lines...
});

const resolveTrainerEntitlement = (trainer: Trainer) =>
  resolveEntitlement(trainerToBillingState(trainer), {
    isRevenueCatOnly: isRevenueCatOnlyMode(),
    clock: billingClock,
  });
```

with:

```ts
const resolveTrainerEntitlement = (trainer: Trainer) =>
  resolveEntitlement(toBillingState(trainer), {
    isRevenueCatOnly: isRevenueCatOnlyMode(),
    clock: billingClock,
  });
```

Add the import (near the other billing imports around line 44-47):
```ts
import { toBillingState } from "../services/billing/trainerBillingState";
```
Remove the now-unused `BillingState` type import if it is no longer referenced anywhere in the file. Leave `billingClock`, `resolveEntitlement`, `isRevenueCatOnlyMode`, and the call sites at `:530`/`:804` (`resolveTrainerEntitlement(trainer)`) unchanged.

- [ ] **Step 7: Typecheck**

Run: `cd C:\dev\Trainee\server && node ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add server/src/services/billing/trainerBillingState.ts server/src/tests/trainerBillingState.test.ts server/src/services/billing/adapters/SequelizeBillingStateRepo.ts server/src/controllers/trainer.ts
git commit -m "refactor(billing): extract shared toBillingState mapper"
```

---

### Task 2: `activeSubscriptionWhere` builder + parity test

The core. TDD: the parity test IS the sync guarantee — it asserts the SQL form and `resolveEntitlement` agree across every branch, in both billing modes.

**Files:**
- Create: `server/src/services/billing/activeSubscriptionScope.ts`
- Test: `server/src/tests/activeSubscription.parity.test.ts`

**Interfaces:**
- Consumes: `Op`, `WhereOptions` from `sequelize`; `subStatus`, `BillingProvider` from billing types; `isRevenueCatOnlyMode` from `config/billingMode`.
- Produces: `activeSubscriptionWhere(opts?: { isRevenueCatOnly?: boolean; now?: Date }): WhereOptions`.

- [ ] **Step 1: Write the failing parity test**

```ts
// server/src/tests/activeSubscription.parity.test.ts
import { describe, it, expect, beforeAll } from "@jest/globals";
import { activeSubscriptionWhere } from "../services/billing/activeSubscriptionScope";
import { resolveEntitlement, Clock } from "../services/billing/domain";
import { BillingProvider, BillingState, subStatus } from "../services/billing/types";
import { Trainer } from "../models/trainer";
import { User } from "../models/user";

const now = new Date("2027-06-01T00:00:00Z");
const future = new Date(now.getTime() + 86_400_000);
const past = new Date(now.getTime() - 86_400_000);
const clock: Clock = { now: () => now, nowMs: () => now.getTime() };

// One fixture per resolveEntitlement branch. `billing` is spread onto both the
// BillingState (truth) and the Trainer row (SQL).
const FIXTURES: Array<{ label: string; billing: Partial<BillingState> }> = [
  { label: "trial-future",        billing: { subscriptionStatus: subStatus.TRIAL,    billingProvider: BillingProvider.APPLE,  trialEndsAt: future } },
  { label: "trial-past",          billing: { subscriptionStatus: subStatus.TRIAL,    billingProvider: BillingProvider.APPLE,  trialEndsAt: past } },
  { label: "trial-null",          billing: { subscriptionStatus: subStatus.TRIAL,    billingProvider: BillingProvider.APPLE } },
  { label: "apple-future",        billing: { subscriptionStatus: subStatus.ACTIVE,   billingProvider: BillingProvider.APPLE,  iapExpiresAt: future } },
  { label: "apple-past",          billing: { subscriptionStatus: subStatus.ACTIVE,   billingProvider: BillingProvider.APPLE,  iapExpiresAt: past } },
  { label: "apple-null",          billing: { subscriptionStatus: subStatus.ACTIVE,   billingProvider: BillingProvider.APPLE } },
  { label: "google-future",       billing: { subscriptionStatus: subStatus.ACTIVE,   billingProvider: BillingProvider.GOOGLE, iapExpiresAt: future } },
  { label: "google-past",         billing: { subscriptionStatus: subStatus.ACTIVE,   billingProvider: BillingProvider.GOOGLE, iapExpiresAt: past } },
  { label: "stripe-future",       billing: { subscriptionStatus: subStatus.ACTIVE,   billingProvider: BillingProvider.STRIPE, currentPeriodEndsAt: future } },
  { label: "stripe-null",         billing: { subscriptionStatus: subStatus.ACTIVE,   billingProvider: BillingProvider.STRIPE } },
  { label: "stripe-past",         billing: { subscriptionStatus: subStatus.ACTIVE,   billingProvider: BillingProvider.STRIPE, currentPeriodEndsAt: past } },
  { label: "provider-none",       billing: { subscriptionStatus: subStatus.ACTIVE,   billingProvider: BillingProvider.NONE } },
  { label: "past-due",            billing: { subscriptionStatus: subStatus.PAST,     billingProvider: BillingProvider.APPLE,  iapExpiresAt: future } },
  { label: "canceled",            billing: { subscriptionStatus: subStatus.CANCELED, billingProvider: BillingProvider.APPLE,  iapExpiresAt: future } },
];

const created: Array<{ id: number; state: BillingState }> = [];

beforeAll(async () => {
  let i = 0;
  for (const fx of FIXTURES) {
    i += 1;
    const user = await User.create({
      email: `parity_${Date.now()}_${i}@test.com`,
      password: "Test123!",
      firstName: "Parity",
      lastName: fx.label,
      role: "trainer" as any,
    });
    const trainer = await Trainer.create({ userId: user.id, ...(fx.billing as any) });
    const state: BillingState = {
      trainerId: trainer.id,
      userId: user.id,
      billingProvider: fx.billing.billingProvider ?? BillingProvider.NONE,
      subscriptionStatus: fx.billing.subscriptionStatus ?? subStatus.CANCELED,
      trialEndsAt: fx.billing.trialEndsAt,
      iapExpiresAt: fx.billing.iapExpiresAt,
      currentPeriodEndsAt: fx.billing.currentPeriodEndsAt,
    };
    created.push({ id: trainer.id, state });
  }
});

describe("activeSubscriptionWhere ⇄ resolveEntitlement parity", () => {
  for (const isRevenueCatOnly of [true, false]) {
    it(`agrees with resolveEntitlement (isRevenueCatOnly=${isRevenueCatOnly})`, async () => {
      const truthIds = created
        .filter((c) => resolveEntitlement(c.state, { isRevenueCatOnly, clock }).isActive)
        .map((c) => c.id)
        .sort((a, b) => a - b);

      const ids = created.map((c) => c.id);
      const rows = await Trainer.findAll({
        where: { id: ids as any, ...(activeSubscriptionWhere({ isRevenueCatOnly, now }) as any) },
        attributes: ["id"],
      });
      const sqlIds = rows.map((r) => r.id).sort((a, b) => a - b);

      expect(sqlIds).toEqual(truthIds);
    });
  }
});
```

> Note: `where: { id: ids, ...activeSubscriptionWhere(...) }` scopes the query to just this test's fixtures so a shared test DB with other rows can't pollute the comparison. The spread merges the plain `id` key with the builder's `Op.and` key (different keys — no collision).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\dev\Trainee\server && npx jest src/tests/activeSubscription.parity.test.ts`
Expected: FAIL — `Cannot find module '../services/billing/activeSubscriptionScope'`.

- [ ] **Step 3: Write the builder**

```ts
// server/src/services/billing/activeSubscriptionScope.ts
import { Op, WhereOptions } from "sequelize";
import { BillingProvider, subStatus } from "./types";
import { isRevenueCatOnlyMode } from "../../config/billingMode";

/**
 * SQL mirror of `resolveEntitlement(state).isActive === true`, as a mergeable
 * Sequelize where fragment. The rule itself lives in domain.ts; this is only its
 * bulk form. Kept in sync by activeSubscription.parity.test.ts.
 *
 * Nests its Op.or under Op.and so it NEVER collides with a caller's own Op.or
 * (e.g. bio/name text search).
 */
export function activeSubscriptionWhere(
  opts: { isRevenueCatOnly?: boolean; now?: Date } = {},
): WhereOptions {
  const now = opts.now ?? new Date();
  const rcOnly = opts.isRevenueCatOnly ?? isRevenueCatOnlyMode();
  const future = { [Op.gt]: now };

  const branches: WhereOptions[] = [
    // domain.ts:46-54 — TRIAL still running (provider-agnostic)
    { subscriptionStatus: subStatus.TRIAL, trialEndsAt: future },
    // domain.ts:64-72 — ACTIVE IAP not expired
    {
      subscriptionStatus: subStatus.ACTIVE,
      billingProvider: { [Op.in]: [BillingProvider.APPLE, BillingProvider.GOOGLE] },
      iapExpiresAt: future,
    },
  ];

  // domain.ts:82-99 — Stripe, only when Stripe runtime is enabled
  if (!rcOnly) {
    branches.push({
      subscriptionStatus: subStatus.ACTIVE,
      billingProvider: BillingProvider.STRIPE,
      [Op.or]: [{ currentPeriodEndsAt: future }, { currentPeriodEndsAt: null }],
    });
  }

  return { [Op.and]: [{ [Op.or]: branches }] };
}
```

- [ ] **Step 4: Run the parity test to verify it passes**

Run: `cd C:\dev\Trainee\server && npx jest src/tests/activeSubscription.parity.test.ts`
Expected: PASS — both `isRevenueCatOnly` cases green (14 fixtures agree in each mode).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/billing/activeSubscriptionScope.ts server/src/tests/activeSubscription.parity.test.ts
git commit -m "feat(billing): SQL mirror of active-entitlement rule + parity test"
```

---

### Task 3: Register the `active` scope on the Trainer model

Exposes the builder as `Trainer.scope("active")`. The integration test proves the `Op.and` nesting keeps a caller's `Op.or` (text search) from dropping the subscription filter — the Bug 2 fix.

**Files:**
- Modify: `server/src/models/trainer.ts`
- Test: append to `server/src/tests/activeSubscription.parity.test.ts`

**Interfaces:**
- Consumes: `activeSubscriptionWhere` (Task 2).
- Produces: `Trainer.scope("active")` — a query scope applying `activeSubscriptionWhere()` with default (env) mode and a fresh `now` per query.

- [ ] **Step 1: Write the failing scope-merge test**

Append to `server/src/tests/activeSubscription.parity.test.ts`:

```ts
import { Op } from "sequelize";

describe("Trainer.scope('active') merge safety", () => {
  it("keeps the active filter when the caller adds its own Op.or (text search)", async () => {
    // Two trainers with a shared bio token: one active (apple-future), one canceled.
    const active = created.find((c) => c.state.subscriptionStatus === subStatus.ACTIVE
      && c.state.billingProvider === BillingProvider.APPLE
      && c.state.iapExpiresAt)!;
    const canceled = created.find((c) => c.state.subscriptionStatus === subStatus.CANCELED)!;
    await Trainer.update({ bio: "zzmergecheck" }, { where: { id: [active.id, canceled.id] as any } });

    const rows = await Trainer.scope("active").findAll({
      where: { [Op.or]: [{ bio: { [Op.iLike]: "%zzmergecheck%" } }] },
      attributes: ["id"],
    });
    const ids = rows.map((r) => r.id);

    expect(ids).toContain(active.id);      // active + bio match → included
    expect(ids).not.toContain(canceled.id); // canceled → filtered despite bio match
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd C:\dev\Trainee\server && npx jest src/tests/activeSubscription.parity.test.ts -t "merge safety"`
Expected: FAIL — `Invalid scope active called` (scope not defined yet).

- [ ] **Step 3: Register the scope on the model**

In `server/src/models/trainer.ts`:
- Add `Scopes` to the `sequelize-typescript` import list (line 5-19 block):
```ts
  UpdatedAt,
  Scopes,
} from "sequelize-typescript";
```
- Add import for the builder near the other imports (after line 25):
```ts
import { activeSubscriptionWhere } from "../services/billing/activeSubscriptionScope";
```
- Add the `@Scopes` decorator immediately above the existing `@Table({...})` decorator (line 27):
```ts
@Scopes(() => ({
  // Only trainers whose subscription is active per resolveEntitlement.
  // Function scope → evaluated per query, so `now` is always fresh.
  active: () => ({ where: activeSubscriptionWhere() }),
}))
@Table({
  tableName: "trainer_profiles",
  timestamps: true,
})
```

> The scope file imports only billing types + config + sequelize — it does NOT import the `Trainer` model, so `model → scope` introduces no import cycle.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd C:\dev\Trainee\server && npx jest src/tests/activeSubscription.parity.test.ts`
Expected: PASS — parity (both modes) + merge-safety all green.

- [ ] **Step 5: Typecheck**

Run: `cd C:\dev\Trainee\server && node ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/models/trainer.ts server/src/tests/activeSubscription.parity.test.ts
git commit -m "feat(billing): Trainer.scope('active') query scope"
```

---

### Task 4: Rewire `searchTrainers` to the scope; delete both hand-rolled filters

Deletes duplication copy #4 (and its re-paste), fixes Bug 1 (divergent filter) and Bug 2 (`Op.or` collision leaking inactive trainers into bio search).

**Files:**
- Modify: `server/src/controllers/trainer.ts` (search: `:852-860`, `:1021`, `:1031`, `:1063-1069`, `:1125`)
- Test: existing `server/src/tests/trainer.test.ts` must still pass.

**Interfaces:**
- Consumes: `Trainer.scope("active")` (Task 3).
- Produces: no new exports; `searchTrainers` now filters active trainers via the scope on every query.

- [ ] **Step 1: Delete the initial hand-rolled subscription filter**

In `server/src/controllers/trainer.ts`, replace the block at lines 852-861:

```ts
    const trainerWhere: any = {
      [Op.or]: [
        { subscriptionStatus: subStatus.ACTIVE },
        {
          subscriptionStatus: subStatus.TRIAL,
          trialEndsAt: { [Op.gt]: new Date() },
        },
      ],
    };
    const userWhere: any = {};
```

with:

```ts
    // Active-subscription filtering is applied via Trainer.scope("active") on
    // every query below — do not hand-roll it here (keeps one source of truth).
    const trainerWhere: any = {};
    const userWhere: any = {};
```

- [ ] **Step 2: Scope the two id-gathering queries under `if (q)`**

At line 1021, change:
```ts
      const trainersByName = await Trainer.findAll({
        where: { userId: { [Op.in]: userIds } },
        attributes: ["id"],
      });
```
to:
```ts
      const trainersByName = await Trainer.scope("active").findAll({
        where: { userId: { [Op.in]: userIds } },
        attributes: ["id"],
      });
```

At line 1031, change:
```ts
      const trainersByBio = await Trainer.findAll({
        where: bioTrainerWhere,
        attributes: ["id"],
      });
```
to:
```ts
      const trainersByBio = await Trainer.scope("active").findAll({
        where: bioTrainerWhere,
        attributes: ["id"],
      });
```

- [ ] **Step 3: Delete the re-pasted subscription filter**

At lines 1063-1069, delete the re-paste entirely:
```ts
      // Re-apply non-text filters
      finalTrainerWhere[Op.or] = [
        { subscriptionStatus: subStatus.ACTIVE },
        {
          subscriptionStatus: subStatus.TRIAL,
          trialEndsAt: { [Op.gt]: new Date() },
        },
      ];
      if (isAvailable === "true") finalTrainerWhere.isAvailable = true;
```
becomes (keep the comment and every non-subscription re-apply line; only the `finalTrainerWhere[Op.or] = [...]` assignment is removed):
```ts
      // Re-apply non-text filters
      if (isAvailable === "true") finalTrainerWhere.isAvailable = true;
```

- [ ] **Step 4: Scope the final `findAndCountAll`**

At line 1125, change:
```ts
    const { count, rows } = await Trainer.findAndCountAll({
      where: finalTrainerWhere,
```
to:
```ts
    const { count, rows } = await Trainer.scope("active").findAndCountAll({
      where: finalTrainerWhere,
```

- [ ] **Step 5: Verify `subStatus` is still used elsewhere in the file**

Run: `cd C:\dev\Trainee\server && npx jest --listTests >/dev/null; grep -n "subStatus" src/controllers/trainer.ts`
If `subStatus` is no longer referenced anywhere in `trainer.ts`, remove it from the import at the top of the file. If it is still used (e.g. analytics/other handlers), leave the import. Do the same check for `Op` (it is still used by the other filters — leave it).

- [ ] **Step 6: Typecheck**

Run: `cd C:\dev\Trainee\server && node ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run the existing trainer search tests**

Run: `cd C:\dev\Trainee\server && npx jest src/tests/trainer.test.ts`
Expected: PASS. (If any existing test seeded an ACTIVE-status-but-expired-IAP or Stripe-in-RC-only trainer and expected it in results, that expectation was asserting the old bug — update the test's seed to a genuinely active trainer, e.g. `billingProvider: 'apple', subscriptionStatus: 'active', iapExpiresAt: <future>`. Do NOT weaken the scope to satisfy a test that encoded the bug.)

- [ ] **Step 8: Commit**

```bash
git add server/src/controllers/trainer.ts
git commit -m "fix(search): filter trainers via active scope; drop divergent SQL filter"
```

---

### Task 5: Rewire `suggestTrainers` to the scope

Deletes the last SQL copy of the rule (`recommendation.ts:92-97`).

**Files:**
- Modify: `server/src/controllers/recommendation.ts:91-98`
- Test: existing `server/src/tests/recommendation.test.ts` must still pass.

**Interfaces:**
- Consumes: `Trainer.scope("active")` (Task 3).

- [ ] **Step 1: Replace the hand-rolled filter with the scope**

In `server/src/controllers/recommendation.ts`, change lines 91-98:
```ts
    const trainers = await Trainer.findAll({
      where: {
        [Op.or]: [
          { subscriptionStatus: subStatus.ACTIVE },
          { subscriptionStatus: subStatus.TRIAL, trialEndsAt: { [Op.gt]: new Date() } },
        ],
      },
      attributes: [
```
to:
```ts
    const trainers = await Trainer.scope("active").findAll({
      attributes: [
```
(The `where` block is removed entirely; the rest of the query — `attributes`, `include` — is unchanged.)

- [ ] **Step 2: Remove now-unused imports**

Run: `cd C:\dev\Trainee\server && grep -n "subStatus\|Op\." src/controllers/recommendation.ts`
If `subStatus` is no longer referenced, remove `import { subStatus } from "../types/trainer";` (line 11). If `Op` is no longer referenced, remove `import { Op } from "sequelize";` (line 2). Only remove each if the grep shows no remaining use.

- [ ] **Step 3: Typecheck**

Run: `cd C:\dev\Trainee\server && node ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the recommendation tests**

Run: `cd C:\dev\Trainee\server && npx jest src/tests/recommendation.test.ts`
Expected: PASS. (Same caveat as Task 4 Step 7 — if a seed relied on the old lenient filter, fix the seed to a genuinely-active trainer, not the scope.)

- [ ] **Step 5: Commit**

```bash
git add server/src/controllers/recommendation.ts
git commit -m "fix(recommendation): filter suggestions via active scope"
```

---

### Task 6: Regression guard against re-introducing the hand-rolled filter

A grep-based test (the project's `npm run lint` only aliases typecheck, so there's no ESLint rule engine to hook). Fails CI if the divergent literal reappears outside the scope module.

**Files:**
- Test: `server/src/tests/noHandRolledSubscriptionFilter.test.ts`

**Interfaces:**
- Consumes: nothing (reads source files from disk).

- [ ] **Step 1: Write the guard test (expected to pass once Tasks 4-5 are done)**

```ts
// server/src/tests/noHandRolledSubscriptionFilter.test.ts
import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";
import { globSync } from "glob";

// The active-subscription rule must exist in exactly one SQL form:
// activeSubscriptionScope.ts. Anywhere else, pairing a `subscriptionStatus`
// filter with a `trialEndsAt` comparison is the old divergent hand-rolled
// filter — ban it so it can't silently come back.
describe("no hand-rolled subscription filter", () => {
  it("only activeSubscriptionScope.ts pairs subscriptionStatus with trialEndsAt in a where", () => {
    const root = join(__dirname, "..");
    const files = globSync("**/*.ts", {
      cwd: root,
      ignore: ["tests/**", "services/billing/activeSubscriptionScope.ts"],
      absolute: true,
    });

    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return src.includes("subscriptionStatus") && /trialEndsAt/.test(src)
        && /\[Op\.or\]/.test(src)
        && /subStatus\.(ACTIVE|TRIAL)/.test(src);
    });

    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Confirm `glob` is available**

Run: `cd C:\dev\Trainee\server && node -e "require('glob'); console.log('glob ok')"`
Expected: `glob ok`. If it errors with `Cannot find module 'glob'`, replace the glob usage with a small recursive `fs.readdirSync` walk over `src` (no new dependency):
```ts
import { readdirSync, statSync } from "fs";
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
// const files = walk(root).filter((f) => f.endsWith(".ts")
//   && !f.includes(`${join("src","tests")}`)
//   && !f.endsWith("activeSubscriptionScope.ts"));
```

- [ ] **Step 3: Run the guard**

Run: `cd C:\dev\Trainee\server && npx jest src/tests/noHandRolledSubscriptionFilter.test.ts`
Expected: PASS — offenders is empty (Tasks 4 and 5 removed the only two matches).

- [ ] **Step 4: Commit**

```bash
git add server/src/tests/noHandRolledSubscriptionFilter.test.ts
git commit -m "test(billing): guard against re-adding hand-rolled subscription filter"
```

---

### Task 7: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole server suite serially**

Run: `cd C:\dev\Trainee\server && npx jest --runInBand`
Expected: all suites pass. (Use `--runInBand` — the suites share one Postgres and `sync({force:true})` each, so parallel runs truncate each other. This is pre-existing behavior, not introduced here.)

- [ ] **Step 2: Typecheck**

Run: `cd C:\dev\Trainee\server && node ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

---

## Self-Review

**Spec coverage (against the RFC):**
- SQL mirror `activeSubscriptionWhere` in `services/billing` → Task 2. ✓
- `Op.and` nesting fixes Bug 2 → Task 2 (builder) + Task 3 (merge-safety test). ✓
- Honors `isRevenueCatOnly` (drops Stripe branch) → Task 2 (builder + parity asserts both modes). ✓
- Exposed as `Trainer.scope("active")` (named, not default) → Task 3. ✓
- searchTrainers: delete both hand-filters, scope all queries → Task 4. ✓
- suggestTrainers: use scope → Task 5. ✓
- Delete per-row mapper duplication (#2/#3), reuse one `toBillingState` → Task 1. ✓
- Parity test over the branch matrix, both modes → Task 2. ✓
- Regression guard → Task 6. ✓
- `middleware/subscription.ts` untouched → not modified by any task. ✓
- Expr compiler NOT built → confirmed absent. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows full content. The "remove import if unused" steps (T1S5-6, T4S5, T5S2) are explicit conditional instructions with the exact grep to decide, not vague hand-waving.

**Type consistency:** `toBillingState(trainer: Trainer): BillingState` identical in Task 1 (def) and Task 3/parity usage. `activeSubscriptionWhere(opts?: { isRevenueCatOnly?; now? }): WhereOptions` identical in Task 2 (def), Task 3 (scope), and the parity test. `resolveEntitlement(state, {isRevenueCatOnly, clock})` matches the existing `domain.ts` signature. Enum values match `src/types/trainer.ts` verbatim.

**Excluded per RFC (not gaps):** Expr/EntitlementQuery compiler, `defaultScope`, partial index — all deliberately deferred with named upgrade paths.
