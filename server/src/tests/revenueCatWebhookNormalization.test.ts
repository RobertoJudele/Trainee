import { describe, it, expect } from "@jest/globals";
import { normalizeRevenueCatEvent } from "../services/billing/domain";

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
