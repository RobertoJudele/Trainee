import { describe, it, expect } from "@jest/globals";
import { BillingService, BillingError } from "../services/billing/BillingService";
import { BillingConfig, BillingStateRepository, RevenueCatGateway } from "../services/billing/ports";
import { Clock, OPEN_ENDED_GRANT_UNTIL } from "../services/billing/domain";
import { BillingProvider, BillingState, subStatus } from "../services/billing/types";

/**
 * Trainers are free until Salvio converts them by hand: signup grants open-ended
 * access, and an admin ends it with optional notice. RevenueCat is faked so the
 * calls the service makes to it can be asserted on.
 */

const now = new Date("2026-10-20T10:00:00Z");
const clock: Clock = { now: () => now, nowMs: () => now.getTime() };
const DAY_MS = 24 * 60 * 60 * 1000;

const config = {
  isRevenueCatOnlyMode: () => true,
  getRevenueCatEntitlementId: () => "Trainee Pro",
  hasRevenueCatApiKey: () => true,
} as unknown as BillingConfig;

const freshTrainer: BillingState = {
  trainerId: 1,
  userId: 42,
  billingProvider: BillingProvider.NONE,
  subscriptionStatus: subStatus.TRIAL,
  trialEndsAt: now,
};

const setup = (initial: BillingState) => {
  let state = initial;
  const repo = {
    findByUserId: async () => state,
    save: async (next: BillingState) => {
      state = next;
    },
  } as unknown as BillingStateRepository;

  const rcCalls: string[] = [];
  const rc = {
    grantPromotionalEntitlement: async (_user: string, _ent: string, endMs: number) => {
      rcCalls.push(`grant:${new Date(endMs).toISOString()}`);
    },
    revokePromotionalEntitlements: async () => {
      rcCalls.push("revoke");
    },
  } as unknown as RevenueCatGateway;

  const service = new BillingService(
    repo,
    null as never,
    null as never,
    null as never,
    rc,
    config,
    clock,
  );
  return { service, rcCalls, current: () => state };
};

describe("grantFreeAccess", () => {
  it("gives a new trainer open-ended free access", async () => {
    const { service, rcCalls } = setup(freshTrainer);

    expect(await service.grantFreeAccess(42)).toBe(true);

    const entitlement = await service.getEntitlement(42);
    expect(entitlement.isActive).toBe(true);
    expect(entitlement.isPromotional).toBe(true);
    expect(entitlement.isOpenEnded).toBe(true);
    expect(entitlement.expiresAt).toEqual(OPEN_ENDED_GRANT_UNTIL);
    expect(rcCalls).toEqual([`grant:${OPEN_ENDED_GRANT_UNTIL.toISOString()}`]);
  });

  it("extends the old 3-month founding grant to open-ended", async () => {
    const { service, current } = setup({
      ...freshTrainer,
      trialEndsAt: new Date("2026-12-01T00:00:00Z"),
    });

    expect(await service.grantFreeAccess(42)).toBe(true);
    expect(current().trialEndsAt).toEqual(OPEN_ENDED_GRANT_UNTIL);
  });

  it("is a no-op for a trainer who is already open-ended", async () => {
    const { service, rcCalls } = setup({ ...freshTrainer, trialEndsAt: OPEN_ENDED_GRANT_UNTIL });

    expect(await service.grantFreeAccess(42)).toBe(false);
    expect(rcCalls).toEqual([]);
  });

  it("leaves a paying trainer alone", async () => {
    const paying: BillingState = {
      ...freshTrainer,
      billingProvider: BillingProvider.APPLE,
      subscriptionStatus: subStatus.ACTIVE,
      iapExpiresAt: new Date(now.getTime() + 20 * DAY_MS),
    };
    const { service, current } = setup(paying);

    expect(await service.grantFreeAccess(42)).toBe(false);
    expect(current()).toEqual(paying);
  });
});

describe("endFreeAccess", () => {
  const openEnded: BillingState = { ...freshTrainer, trialEndsAt: OPEN_ENDED_GRANT_UNTIL };

  it("ends access immediately with no notice", async () => {
    const { service, rcCalls } = setup(openEnded);

    const entitlement = await service.endFreeAccess(42, 0);

    expect(entitlement.isActive).toBe(false);
    // Revoked in RevenueCat too, or the next sync would restore the access.
    expect(rcCalls).toEqual(["revoke"]);
  });

  it("keeps access through the notice period, as a dated grant", async () => {
    const { service, rcCalls } = setup(openEnded);
    const endsAt = new Date(now.getTime() + 7 * DAY_MS);

    const entitlement = await service.endFreeAccess(42, 7);

    expect(entitlement.isActive).toBe(true);
    expect(entitlement.isOpenEnded).toBe(false);
    expect(entitlement.expiresAt).toEqual(endsAt);
    // Revoke first: a new promotional grant does not shorten an existing one.
    expect(rcCalls).toEqual(["revoke", `grant:${endsAt.toISOString()}`]);
  });

  it("refuses a paying trainer", async () => {
    const { service, rcCalls } = setup({
      ...freshTrainer,
      billingProvider: BillingProvider.GOOGLE,
      subscriptionStatus: subStatus.ACTIVE,
      iapExpiresAt: new Date(now.getTime() + 20 * DAY_MS),
    });

    await expect(service.endFreeAccess(42, 0)).rejects.toMatchObject({
      code: "NO_FREE_ACCESS",
    });
    expect(rcCalls).toEqual([]);
  });

  it("refuses a trainer whose access has already lapsed", async () => {
    const { service } = setup(freshTrainer);

    await expect(service.endFreeAccess(42, 0)).rejects.toBeInstanceOf(BillingError);
  });
});

describe("founding offer", () => {
  it("is always closed, so older app builds hide the 3-month banner", () => {
    const { service } = setup(freshTrainer);
    expect(service.getFoundingGrantOffer()).toEqual({ isOpen: false, months: 0 });
  });
});
