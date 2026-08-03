import { isRevenueCatOnlyMode, isStripeRuntimeEnabled } from "../../../config/billingMode";
import { BillingConfig } from "../ports";

const DEFAULT_SUCCESS_URL = "http://localhost:8081/checkout?success=true&session_id={CHECKOUT_SESSION_ID}";
const DEFAULT_CANCEL_URL = "http://localhost:8081/checkout?canceled=true";
const DEFAULT_ENTITLEMENT_ID = "trainer_subscription";
const DEFAULT_FOUNDING_GRANT_MONTHS = 3;
// Founding-trainer promo: every trainer profile created up to and including
// this date gets the free grant. Bump/clear the env var to move or end it.
const DEFAULT_FOUNDING_GRANT_DEADLINE = "2026-09-30";

export class EnvBillingConfig implements BillingConfig {
  isStripeEnabled(): boolean {
    return isStripeRuntimeEnabled();
  }

  isRevenueCatOnlyMode(): boolean {
    return isRevenueCatOnlyMode();
  }

  getRevenueCatEntitlementId(): string {
    return process.env.REVENUECAT_ENTITLEMENT_ID?.trim() || DEFAULT_ENTITLEMENT_ID;
  }

  getStripeTrialDays(): number {
    const days = Number(process.env.STRIPE_TRIAL_DAYS || 30);
    return Number.isFinite(days) && days > 0 ? days : 0;
  }

  getDefaultPriceId(): string | undefined {
    return process.env.STRIPE_SUBSCRIPTION_PRICE_ID?.trim()
      || process.env.STRIPE_PRICE_ID?.trim()
      || undefined;
  }

  getStripeWebhookSecret(): string | undefined {
    return process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined;
  }

  getStripeSuccessUrl(): string {
    return process.env.STRIPE_SUCCESS_URL?.trim() || DEFAULT_SUCCESS_URL;
  }

  getStripeCancelUrl(): string {
    return process.env.STRIPE_CANCEL_URL?.trim() || DEFAULT_CANCEL_URL;
  }

  getStripePortalReturnUrl(): string {
    return process.env.STRIPE_PORTAL_RETURN_URL?.trim()
      || this.getStripeSuccessUrl();
  }

  hasRevenueCatApiKey(): boolean {
    return Boolean(process.env.REVENUECAT_SECRET_API_KEY?.trim());
  }

  getFoundingGrantMonths(): number {
    const months = Number(
      process.env.FOUNDING_GRANT_MONTHS || DEFAULT_FOUNDING_GRANT_MONTHS,
    );
    return Number.isFinite(months) && months > 0 ? months : 0;
  }

  getFoundingGrantDeadline(): Date | undefined {
    const raw = process.env.FOUNDING_GRANT_DEADLINE?.trim()
      ?? DEFAULT_FOUNDING_GRANT_DEADLINE;
    // Explicitly emptied env var = promo switched off.
    if (!raw) return undefined;
    // End of the named day, so "2026-09-30" includes all of 30 September.
    const deadline = new Date(`${raw}T23:59:59.999Z`);
    return Number.isFinite(deadline.getTime()) ? deadline : undefined;
  }
}
