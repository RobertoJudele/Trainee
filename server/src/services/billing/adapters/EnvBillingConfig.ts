import { isRevenueCatOnlyMode, isStripeRuntimeEnabled } from "../../../config/billingMode";
import { BillingConfig } from "../ports";

const DEFAULT_SUCCESS_URL = "http://localhost:8081/checkout?success=true&session_id={CHECKOUT_SESSION_ID}";
const DEFAULT_CANCEL_URL = "http://localhost:8081/checkout?canceled=true";
const DEFAULT_ENTITLEMENT_ID = "trainer_subscription";

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
}
