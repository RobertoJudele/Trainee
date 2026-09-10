import { describe, it, expect } from "@jest/globals";
import { BillingService } from "../services/billing/BillingService";
import { BillingConfig } from "../services/billing/ports";
import { Clock } from "../services/billing/domain";

/**
 * `getFoundingGrantOffer` is what the app renders the banner from, and
 * `grantFoundingEntitlement` is what actually issues the grant. They read the
 * same config, and these tests pin them to the same gate — a banner advertising
 * an offer the grant would refuse is worse than no banner.
 */

const configWith = (deadline: string | undefined, months: number): BillingConfig =>
  ({
    getFoundingGrantDeadline: () =>
      deadline ? new Date(`${deadline}T23:59:59.999Z`) : undefined,
    getFoundingGrantMonths: () => months,
  }) as unknown as BillingConfig;

const clockAt = (iso: string): Clock => {
  const now = new Date(iso);
  return { now: () => now, nowMs: () => now.getTime() };
};

// Only config and clock are exercised; the repositories and gateways are never
// touched by this method.
const serviceWith = (config: BillingConfig, clock: Clock) =>
  new BillingService(
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    config,
    clock,
  );

const offerOn = (today: string, deadline: string | undefined, months = 3) =>
  serviceWith(configWith(deadline, months), clockAt(today)).getFoundingGrantOffer();

describe("founding grant offer", () => {
  it("is open well before the deadline", () => {
    expect(offerOn("2026-08-13T10:00:00Z", "2026-09-30")).toEqual({
      isOpen: true,
      months: 3,
      deadline: "2026-09-30T23:59:59.999Z",
    });
  });

  it("is still open during the final day", () => {
    // The deadline covers all of 30 September, so a trainer signing up that
    // evening must still see the offer.
    expect(offerOn("2026-09-30T22:00:00Z", "2026-09-30").isOpen).toBe(true);
  });

  it("closes once the deadline has passed", () => {
    const offer = offerOn("2026-10-01T00:00:01Z", "2026-09-30");
    expect(offer.isOpen).toBe(false);
    expect(offer.months).toBe(0);
    // No deadline is sent when closed, so the app cannot render a stale date.
    expect(offer.deadline).toBeUndefined();
  });

  it("is closed when the promo is switched off by clearing the env var", () => {
    expect(offerOn("2026-08-13T10:00:00Z", undefined).isOpen).toBe(false);
  });

  it("is closed when the month count is zero", () => {
    expect(offerOn("2026-08-13T10:00:00Z", "2026-09-30", 0).isOpen).toBe(false);
  });

  it("reports whatever month count is configured, not a hardcoded 3", () => {
    // Extending the promo is an env var, not a code change — the app has to
    // follow the server rather than ship a new build.
    expect(offerOn("2026-08-13T10:00:00Z", "2026-12-31", 12)).toEqual({
      isOpen: true,
      months: 12,
      deadline: "2026-12-31T23:59:59.999Z",
    });
  });
});
