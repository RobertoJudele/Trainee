export enum BillingRuntimeMode {
  REVENUECAT_ONLY = "revenuecat_only",
  HYBRID = "hybrid",
}

const normalizeRuntimeMode = (value?: string): BillingRuntimeMode => {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === BillingRuntimeMode.HYBRID) {
    return BillingRuntimeMode.HYBRID;
  }

  return BillingRuntimeMode.REVENUECAT_ONLY;
};

export const getBillingRuntimeMode = (): BillingRuntimeMode =>
  normalizeRuntimeMode(process.env.BILLING_MODE);

export const isRevenueCatOnlyMode = (): boolean =>
  getBillingRuntimeMode() === BillingRuntimeMode.REVENUECAT_ONLY;

export const isStripeRuntimeEnabled = (): boolean =>
  getBillingRuntimeMode() !== BillingRuntimeMode.REVENUECAT_ONLY;
