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
