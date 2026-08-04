import { describe, it, expect } from "@jest/globals";
import {
  normalizeRevenueCatEvent,
  normalizeRevenueCatSubscriber,
} from "../services/billing/domain";

// The shape RevenueCat actually posts: snake_case, with unset numeric fields
// sent as null rather than omitted. Trimmed to the fields the service reads.
const PROMOTIONAL_GRANT_PAYLOAD = {
  id: "C11165FA-B971-43C2-9CB4-C3222EEC49AA",
  type: "NON_RENEWING_PURCHASE",
  app_user_id: "40",
  original_app_user_id: "40",
  event_timestamp_ms: 1754300000000,
  expiration_at_ms: 1762000000000,
  purchased_at_ms: 1754300000000,
  product_id: "rc_promo_Trainee Pro_three_month",
  entitlement_ids: ["Trainee Pro"],
  period_type: "PROMOTIONAL",
  store: "PROMOTIONAL",
  environment: "PRODUCTION",
  price: null,
  currency: null,
  transaction_id: null,
  original_transaction_id: null,
};

describe("normalizeRevenueCatEvent", () => {
  it("reads the snake_case fields RevenueCat actually sends", () => {
    const event = normalizeRevenueCatEvent(PROMOTIONAL_GRANT_PAYLOAD);

    // The regression: this was undefined, so syncFromRevenueCatEvent computed
    // Number(undefined) === NaN and dropped every event without acting on it.
    expect(event.appUserId).toBe("40");
    expect(event.eventTimestampMs).toBe(1754300000000);
    expect(event.expirationAtMs).toBe(1762000000000);
    expect(event.productId).toBe("rc_promo_Trainee Pro_three_month");
    expect(event.store).toBe("PROMOTIONAL");
    expect(event.id).toBe("C11165FA-B971-43C2-9CB4-C3222EEC49AA");
    expect(event.type).toBe("NON_RENEWING_PURCHASE");
  });

  it("keeps null numeric fields undefined rather than 0", () => {
    // Number(null) is 0, which would read as a real price and a 1970 timestamp.
    const event = normalizeRevenueCatEvent(PROMOTIONAL_GRANT_PAYLOAD);
    expect(event.price).toBeUndefined();
    expect(event.currency).toBeUndefined();
    expect(event.transactionId).toBeUndefined();
    expect(event.originalTransactionId).toBeUndefined();
  });

  it("still accepts camelCase, so fixtures and hand-written payloads keep working", () => {
    const event = normalizeRevenueCatEvent({
      id: "evt_1",
      type: "RENEWAL",
      appUserId: "7",
      eventTimestampMs: 1754300000000,
      expirationAtMs: 1762000000000,
      productId: "com.trainee.trainer_monthly",
      store: "APP_STORE",
      price: 17.99,
      currency: "USD",
    });

    expect(event.appUserId).toBe("7");
    expect(event.eventTimestampMs).toBe(1754300000000);
    expect(event.productId).toBe("com.trainee.trainer_monthly");
    expect(event.price).toBe(17.99);
    expect(event.currency).toBe("USD");
  });

  it("normalizes transfer arrays", () => {
    const event = normalizeRevenueCatEvent({
      id: "evt_2",
      type: "TRANSFER",
      transferred_from: ["11", "12"],
      transferred_to: ["13"],
    });

    expect(event.transferredFrom).toEqual(["11", "12"]);
    expect(event.transferredTo).toEqual(["13"]);
  });

  it("coerces a numeric app_user_id to a string", () => {
    const event = normalizeRevenueCatEvent({ id: "e", type: "T", app_user_id: 40 });
    expect(event.appUserId).toBe("40");
  });

  it("survives an empty payload without inventing values", () => {
    const event = normalizeRevenueCatEvent({});
    expect(event.id).toBe("");
    expect(event.type).toBe("unknown");
    expect(event.appUserId).toBeUndefined();
    expect(event.eventTimestampMs).toBeUndefined();
    expect(event.transferredFrom).toBeUndefined();
  });
});

// The shape the v1 subscriber endpoint actually returns, snake_case throughout.
const APPLE_SUBSCRIBER = {
  entitlements: {
    "Trainee Pro": {
      expires_date: "2026-09-04T10:00:00Z",
      product_identifier: "com.trainee.trainer_monthly",
      purchase_date: "2026-08-04T10:00:00Z",
    },
  },
  subscriptions: {
    "com.trainee.trainer_monthly": {
      expires_date: "2026-09-04T10:00:00Z",
      purchase_date: "2026-08-04T10:00:00Z",
      store: "app_store",
      period_type: "normal",
      original_transaction_id: "2000000123456789",
      store_transaction_id: "2000000987654321",
    },
  },
};

describe("normalizeRevenueCatSubscriber", () => {
  it("reads the dated fields that decide whether an entitlement is active", () => {
    const data = normalizeRevenueCatSubscriber(APPLE_SUBSCRIBER);

    // The regression: these were undefined, so a verified purchase produced a
    // snapshot with no expiry and resolveEntitlement reported it expired.
    expect(data.entitlements["Trainee Pro"].expiresDate).toBe("2026-09-04T10:00:00Z");
    expect(data.entitlements["Trainee Pro"].productIdentifier).toBe("com.trainee.trainer_monthly");

    const sub = data.subscriptions["com.trainee.trainer_monthly"];
    expect(sub.expiresDate).toBe("2026-09-04T10:00:00Z");
    expect(sub.periodType).toBe("normal");
    expect(sub.originalTransactionId).toBe("2000000123456789");
    expect(sub.storeTransactionId).toBe("2000000987654321");
    expect(sub.store).toBe("app_store");
  });

  it("carries a promotional grant's expiry and period through", () => {
    const data = normalizeRevenueCatSubscriber({
      entitlements: {
        "Trainee Pro": {
          expires_date: "2026-11-04T10:51:34Z",
          product_identifier: "rc_promo_Trainee Pro_custom",
        },
      },
      subscriptions: {
        "rc_promo_Trainee Pro_custom": {
          expires_date: "2026-11-04T10:51:34Z",
          store: "promotional",
          period_type: "promotional",
        },
      },
    });

    expect(data.entitlements["Trainee Pro"].expiresDate).toBe("2026-11-04T10:51:34Z");
    expect(data.subscriptions["rc_promo_Trainee Pro_custom"].periodType).toBe("promotional");
  });

  it("still accepts camelCase so existing fixtures keep working", () => {
    const data = normalizeRevenueCatSubscriber({
      entitlements: { "Trainee Pro": { expiresDate: "2026-09-04T10:00:00Z" } },
      subscriptions: { p: { expiresDate: "2026-09-04T10:00:00Z", periodType: "trial" } },
    });

    expect(data.entitlements["Trainee Pro"].expiresDate).toBe("2026-09-04T10:00:00Z");
    expect(data.subscriptions.p.periodType).toBe("trial");
  });

  it("tolerates an empty or malformed subscriber", () => {
    expect(normalizeRevenueCatSubscriber({})).toEqual({ entitlements: {}, subscriptions: {} });
    expect(normalizeRevenueCatSubscriber({ entitlements: null, subscriptions: "nope" }))
      .toEqual({ entitlements: {}, subscriptions: {} });
  });
});
