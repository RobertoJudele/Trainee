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

import { Op, Sequelize } from "sequelize";

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

  // Regression: applyGeoFilters (trainer.ts) sets a TOP-LEVEL Op.and (the
  // ST_DWithin radius literal) — the SAME symbol key the scope uses. Under
  // Sequelize's default whereMergeStrategy the query's Op.and overwrites the
  // scope's, silently dropping the active filter on every radius search. The
  // Op.or test above can't catch this because Op.or is a different key.
  it("keeps the active filter when the caller adds its own Op.and (geo/radius)", async () => {
    const active = created.find((c) => c.state.subscriptionStatus === subStatus.ACTIVE
      && c.state.billingProvider === BillingProvider.APPLE
      && c.state.iapExpiresAt)!;
    const canceled = created.find((c) => c.state.subscriptionStatus === subStatus.CANCELED)!;

    const rows = await Trainer.scope("active").findAll({
      where: { id: [active.id, canceled.id] as any, [Op.and]: [Sequelize.literal("1=1")] },
      attributes: ["id"],
    });
    const ids = rows.map((r) => r.id);

    expect(ids).toContain(active.id);       // active + passes radius → included
    expect(ids).not.toContain(canceled.id); // canceled must NOT leak in
  });
});
