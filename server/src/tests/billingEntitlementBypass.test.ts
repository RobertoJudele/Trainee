import { describe, expect, it } from "@jest/globals";
import { resolveRevenueCatSnapshot } from "../services/billing/domain";
import { RevenueCatSubscriberData } from "../services/billing/types";

// Regression guard for the entitlement bypass: `isActive` used to be
// `!expiresAt || expiresAt > now`, so a subscriber RevenueCat knows nothing about
// resolved as active. Combined with POST /billing/revenuecat/sync forwarding a
// client-supplied `expiresAt`, any authenticated trainer could grant themselves a
// never-expiring subscription without paying.

const NOW = Date.UTC(2026, 6, 30);
const clock = { now: () => new Date(NOW), nowMs: () => NOW };
const future = new Date(NOW + 86_400_000);
const past = new Date(NOW - 86_400_000);

const EMPTY: RevenueCatSubscriberData = { entitlements: {}, subscriptions: {} };

const snapshot = (data: RevenueCatSubscriberData, opts: Record<string, unknown> = {}) =>
  resolveRevenueCatSnapshot(data, {
    entitlementId: "Trainee Pro",
    clock,
    ...opts,
  });

describe("resolveRevenueCatSnapshot", () => {
  it("stays inactive when RevenueCat has no record of the subscriber", () => {
    expect(snapshot(EMPTY).isActive).toBe(false);
  });

  it("stays inactive when the only signal is a client-supplied product id", () => {
    const snap = snapshot(EMPTY, { fallbackProductId: "com.trainee.trainer_monthly" });
    expect(snap.isActive).toBe(false);
  });

  it("still activates from a trusted webhook expiry while RevenueCat's API lags", () => {
    expect(snapshot(EMPTY, { fallbackExpiresAt: future }).isActive).toBe(true);
    expect(snapshot(EMPTY, { fallbackExpiresAt: past }).isActive).toBe(false);
  });

  it("activates a genuine entitlement and expires it on time", () => {
    const active = snapshot({
      entitlements: { "Trainee Pro": { expiresDate: future.toISOString() } },
      subscriptions: {},
    } as RevenueCatSubscriberData);
    const expired = snapshot({
      entitlements: { "Trainee Pro": { expiresDate: past.toISOString() } },
      subscriptions: {},
    } as RevenueCatSubscriberData);

    expect(active.isActive).toBe(true);
    expect(expired.isActive).toBe(false);
  });

  it("treats a null expiry on a real entitlement as non-expiring", () => {
    const snap = snapshot({
      entitlements: { "Trainee Pro": { expiresDate: null } },
      subscriptions: {},
    } as unknown as RevenueCatSubscriberData);

    expect(snap.isActive).toBe(true);
  });

  it("falls back to another entitlement id when the configured one does not match", () => {
    const snap = snapshot({
      entitlements: { trainer_subscription: { expiresDate: future.toISOString() } },
      subscriptions: {},
    } as RevenueCatSubscriberData);

    expect(snap.isActive).toBe(true);
  });

  it("activates from subscription data alone", () => {
    const snap = snapshot(
      {
        entitlements: {},
        subscriptions: {
          "com.trainee.trainer_monthly": {
            expiresDate: future.toISOString(),
            store: "APP_STORE",
          },
        },
      } as unknown as RevenueCatSubscriberData,
      { fallbackProductId: "com.trainee.trainer_monthly" },
    );

    expect(snap.isActive).toBe(true);
  });
});
