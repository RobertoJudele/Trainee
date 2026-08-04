import { describe, it, expect } from "@jest/globals";
import {
  applyPromotionalGrant,
  applyRevenueCatSnapshot,
  resolveEntitlement,
  resolveRevenueCatSnapshot,
  Clock,
} from "../services/billing/domain";
import { BillingProvider, BillingState, subStatus } from "../services/billing/types";

const now = new Date("2026-08-02T00:00:00Z");
const clock: Clock = { now: () => now, nowMs: () => now.getTime() };
const threeMonthsOut = new Date("2026-11-02T00:00:00Z");

// A freshly created trainer: createTrainer sets trialEndsAt to the creation
// instant, so the trial is already expired on arrival.
const freshTrainer: BillingState = {
  trainerId: 1,
  userId: 42,
  billingProvider: BillingProvider.NONE,
  subscriptionStatus: subStatus.TRIAL,
  trialEndsAt: now,
};

const entitlementOf = (state: BillingState) =>
  resolveEntitlement(state, { isRevenueCatOnly: true, clock });

const isActive = (state: BillingState) => entitlementOf(state).isActive;

describe("founding promotional grant", () => {
  it("a fresh trainer is not entitled before the grant", () => {
    expect(isActive(freshTrainer)).toBe(false);
  });

  it("grants access for the promo window", () => {
    const granted = applyPromotionalGrant(freshTrainer, threeMonthsOut);
    expect(isActive(granted)).toBe(true);
    expect(granted.trialEndsAt).toEqual(threeMonthsOut);
  });

  it("flags the grant as promotional so the app can label it 'early adopter'", () => {
    expect(entitlementOf(applyPromotionalGrant(freshTrainer, threeMonthsOut)).isPromotional)
      .toBe(true);
  });

  it("does not flag a store trial as promotional", () => {
    // An Apple/Google free trial is a real store subscription and must keep the
    // normal renewal wording, so it must not be labelled early adopter.
    const storeTrial: BillingState = {
      ...freshTrainer,
      billingProvider: BillingProvider.APPLE,
      trialEndsAt: threeMonthsOut,
    };
    const entitlement = entitlementOf(storeTrial);
    expect(entitlement.isActive).toBe(true);
    expect(entitlement.isPromotional).toBe(false);
  });

  it("access lapses once the grant expires", () => {
    const expired = applyPromotionalGrant(freshTrainer, new Date("2026-07-01T00:00:00Z"));
    expect(isActive(expired)).toBe(false);
  });
});

describe("RevenueCat promotional webhook does not revoke the grant", () => {
  // RevenueCat reports granted entitlements as NON_RENEWING_PURCHASE with store
  // and period_type PROMOTIONAL. Before the promotional handling this resolved to
  // provider "none" + status "active", which resolveEntitlement reads as INACTIVE.
  const promoSubscriber = {
    entitlements: {
      "Trainee Pro": {
        expiresDate: threeMonthsOut.toISOString(),
        productIdentifier: "rc_promo_Trainee Pro_three_month",
      },
    },
    subscriptions: {
      "rc_promo_Trainee Pro_three_month": {
        expiresDate: threeMonthsOut.toISOString(),
        store: "promotional",
        periodType: "promotional",
      },
    },
  };

  it("keeps the trainer entitled after syncing the promo webhook", () => {
    const snapshot = resolveRevenueCatSnapshot(promoSubscriber, {
      entitlementId: "Trainee Pro",
      clock,
    });
    const synced = applyRevenueCatSnapshot(freshTrainer, snapshot, { verifiedAt: now });

    expect(synced.subscriptionStatus).toBe(subStatus.TRIAL);
    expect(synced.trialEndsAt).toEqual(threeMonthsOut);
    expect(isActive(synced)).toBe(true);
  });

  it("derives the promo period even when the store subscription is absent", () => {
    const snapshot = resolveRevenueCatSnapshot(
      { entitlements: promoSubscriber.entitlements, subscriptions: {} },
      { entitlementId: "Trainee Pro", fallbackStore: "PROMOTIONAL", clock },
    );
    const synced = applyRevenueCatSnapshot(freshTrainer, snapshot, { verifiedAt: now });

    expect(isActive(synced)).toBe(true);
  });

  it("expires the grant when RevenueCat reports it lapsed", () => {
    const lapsed = {
      entitlements: {
        "Trainee Pro": { expiresDate: "2026-07-01T00:00:00Z", productIdentifier: "rc_promo_x" },
      },
      subscriptions: {
        "rc_promo_x": { expiresDate: "2026-07-01T00:00:00Z", store: "promotional" },
      },
    };
    const snapshot = resolveRevenueCatSnapshot(lapsed, { entitlementId: "Trainee Pro", clock });
    const synced = applyRevenueCatSnapshot(freshTrainer, snapshot, { verifiedAt: now });

    expect(isActive(synced)).toBe(false);
  });

  it("Restore Purchases on iOS does not turn the grant into an Apple subscription", () => {
    // The restore path calls /billing/iap/validate with platform "ios". The
    // platform fallback used to stamp the grant "apple", which made
    // resolveEntitlement report isPromotional false — the app then showed
    // "Trial Period" and "Billed via Apple App Store" for a free grant.
    const snapshot = resolveRevenueCatSnapshot(promoSubscriber, {
      entitlementId: "Trainee Pro",
      platform: "ios",
      fallbackProductId: "rc_promo_Trainee Pro_three_month",
      clock,
    });
    const synced = applyRevenueCatSnapshot(freshTrainer, snapshot, {
      platform: "ios",
      verifiedAt: now,
    });

    expect(synced.billingProvider).toBe(BillingProvider.NONE);
    expect(synced.subscriptionStatus).toBe(subStatus.TRIAL);

    const entitlement = entitlementOf(synced);
    expect(entitlement.isActive).toBe(true);
    expect(entitlement.isPromotional).toBe(true);
  });

  it("a real Apple purchase is still not treated as promotional", () => {
    const applePurchase = {
      entitlements: {
        "Trainee Pro": { expiresDate: threeMonthsOut.toISOString(), productIdentifier: "com.trainee.trainer_monthly" },
      },
      subscriptions: {
        "com.trainee.trainer_monthly": {
          expiresDate: threeMonthsOut.toISOString(),
          store: "app_store",
          periodType: "normal",
        },
      },
    };
    const snapshot = resolveRevenueCatSnapshot(applePurchase, { entitlementId: "Trainee Pro", clock });
    const synced = applyRevenueCatSnapshot(freshTrainer, snapshot, { verifiedAt: now });

    expect(synced.billingProvider).toBe(BillingProvider.APPLE);
    expect(synced.subscriptionStatus).toBe(subStatus.ACTIVE);
    expect(isActive(synced)).toBe(true);
  });
});
