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
