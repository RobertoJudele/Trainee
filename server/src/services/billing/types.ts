import { BillingProvider, subStatus } from "../../types/trainer";

export { BillingProvider, subStatus };

export interface Entitlement {
  isActive: boolean;
  status: subStatus;
  source: BillingProvider;
  expiresAt?: Date;
  reason?: string;
}

export interface BillingState {
  trainerId: number;
  userId: number;
  billingProvider: BillingProvider;
  subscriptionStatus: subStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: Date;
  currentPeriodEndsAt?: Date;
  iapProductId?: string;
  iapExpiresAt?: Date;
  iapLastVerifiedAt?: Date;
  appleOriginalTransactionId?: string;
  googlePurchaseToken?: string;
}

export interface TransactionRecord {
  trainerId: number;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  transactionId: string;
  productId: string;
  paidAt: Date;
}

export interface WebhookEventRecord {
  source: string;
  eventId: string;
  eventType: string;
  appUserId?: string;
  eventTimestampMs?: number;
  payload: Record<string, unknown>;
  processedAt?: Date;
}

export interface StripeSubscriptionSession {
  paymentIntentClientSecret?: string;
  setupIntentClientSecret?: string;
  ephemeralKeySecret: string;
  customerId: string;
  subscriptionId: string;
}

export interface StripeCheckoutSession {
  url: string | null;
  sessionId: string;
}

export interface StripePortalSession {
  url: string;
}

export interface StripeSubscriptionRaw {
  id: string;
  status: string;
  customerId: string;
  trialEnd?: number;
  currentPeriodEnd?: number;
  billingCycleAnchor?: number;
  interval?: string;
  intervalCount?: number;
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    subscriptionId?: string;
    customerId?: string;
    invoiceSubscriptionId?: string;
    checkoutSubscriptionId?: string;
  };
}

export interface RevenueCatSubscriberData {
  entitlements: Record<string, {
    expiresDate?: string | null;
    productIdentifier?: string | null;
  }>;
  subscriptions: Record<string, {
    expiresDate?: string | null;
    store?: string | null;
    originalTransactionId?: string | null;
    storeTransactionId?: string | null;
    purchaseDate?: string | null;
    periodType?: string | null;
  }>;
}

export interface RevenueCatSnapshot {
  isActive: boolean;
  productId?: string;
  expiresAt?: Date;
  provider: BillingProvider;
  originalTransactionId?: string;
  periodType?: string;
}

export type IapPlatform = "ios" | "android";

export interface IapValidationInput {
  platform: IapPlatform;
  productId: string;
  purchaseToken?: string;
  expiresAt?: string | number;
  originalTransactionId?: string;
}

export interface IapValidationResult {
  entitlement: Entitlement;
  provider: BillingProvider;
  iapProductId?: string;
  iapExpiresAt?: Date;
  iapLastVerifiedAt: Date;
}

export interface RevenueCatWebhookEvent {
  id: string;
  type: string;
  appUserId?: string;
  eventTimestampMs?: number;
  productId?: string;
  expirationAtMs?: number;
  originalTransactionId?: string;
  transactionId?: string;
  store?: string;
  transferredFrom?: string[];
  transferredTo?: string[];
  price?: number;
  currency?: string;
}
