// Single source of truth for the trainer subscription plans (1 / 3 / 6 / 12 months).
//
// Each plan maps to a Stripe Price. At runtime the price id is resolved either
// from an explicit env override (envPriceIdVar) or by looking up the Stripe
// Price by its `lookup_key`. Create one Stripe Product ("Trainer Subscription")
// with four recurring prices and set these lookup keys on them.

export type BillingPlanId = "1m" | "3m" | "6m" | "12m";

export interface BillingPlan {
  id: BillingPlanId;
  /** Number of months the subscription covers (its billing interval). */
  months: number;
  /** Stripe Price `lookup_key` to resolve the price id at runtime. */
  lookupKey: string;
  /** Optional env var holding an explicit Stripe price id (takes priority over lookupKey). */
  envPriceIdVar: string;
}

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  "1m": { id: "1m", months: 1, lookupKey: "trainer_1m", envPriceIdVar: "STRIPE_PRICE_ID_1M" },
  "3m": { id: "3m", months: 3, lookupKey: "trainer_3m", envPriceIdVar: "STRIPE_PRICE_ID_3M" },
  "6m": { id: "6m", months: 6, lookupKey: "trainer_6m", envPriceIdVar: "STRIPE_PRICE_ID_6M" },
  "12m": { id: "12m", months: 12, lookupKey: "trainer_12m", envPriceIdVar: "STRIPE_PRICE_ID_12M" },
};

export const BILLING_PLAN_IDS = Object.keys(BILLING_PLANS) as BillingPlanId[];

export const isBillingPlanId = (value: unknown): value is BillingPlanId =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(BILLING_PLANS, value);

export const getBillingPlan = (planId: BillingPlanId): BillingPlan =>
  BILLING_PLANS[planId];
