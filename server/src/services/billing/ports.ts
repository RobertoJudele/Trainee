import {
  BillingState,
  TransactionRecord,
  WebhookEventRecord,
  StripeSubscriptionSession,
  StripeCheckoutSession,
  StripePortalSession,
  StripeSubscriptionRaw,
  StripeWebhookEvent,
  RevenueCatSubscriberData,
} from "./types";
import { BillingPlan } from "../../config/billingPlans";

// ── Persistence ports ───────────────────────────────────────────────

export interface BillingStateRepository {
  findByUserId(userId: number): Promise<BillingState | null>;
  findByStripeCustomerId(customerId: string): Promise<BillingState | null>;
  save(state: BillingState): Promise<void>;
}

export interface TransactionRepository {
  findOrCreate(record: TransactionRecord): Promise<TransactionRecord>;
  findAllByTrainerId(trainerId: number): Promise<TransactionRecord[]>;
}

export interface WebhookEventRepository {
  findBySourceAndEventId(source: string, eventId: string): Promise<WebhookEventRecord | null>;
  create(record: Omit<WebhookEventRecord, "processedAt">): Promise<WebhookEventRecord>;
  markProcessed(source: string, eventId: string): Promise<void>;
}

// ── External service ports ──────────────────────────────────────────

export interface StripeGateway {
  createCustomer(
    email: string,
    name: string,
    metadata: Record<string, string>,
  ): Promise<{ id: string }>;

  createEphemeralKey(
    customerId: string,
    apiVersion: string,
  ): Promise<{ secret: string }>;

  createSubscription(params: {
    customerId: string;
    priceId: string;
    trialDays?: number;
    metadata: Record<string, string>;
  }): Promise<StripeSubscriptionSession>;

  createCheckoutSession(params: {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<StripeCheckoutSession>;

  createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<StripePortalSession>;

  retrieveCheckoutSession(sessionId: string): Promise<{ customerId: string | null }>;

  retrieveSubscription(subscriptionId: string): Promise<StripeSubscriptionRaw>;

  resolvePriceId(plan: BillingPlan): Promise<string>;

  lookupPriceByKey(lookupKey: string): Promise<string | undefined>;

  verifyWebhookSignature(
    payload: Buffer,
    signature: string,
    secret: string,
  ): StripeWebhookEvent;
}

export interface RevenueCatGateway {
  fetchSubscriber(appUserId: string): Promise<RevenueCatSubscriberData>;
  isWebhookAuthorized(authorizationHeader: string | undefined): boolean;
}

// ── Configuration port ──────────────────────────────────────────────

export interface BillingConfig {
  isStripeEnabled(): boolean;
  isRevenueCatOnlyMode(): boolean;
  getRevenueCatEntitlementId(): string;
  getStripeTrialDays(): number;
  getDefaultPriceId(): string | undefined;
  getStripeWebhookSecret(): string | undefined;
  getStripeSuccessUrl(): string;
  getStripeCancelUrl(): string;
  getStripePortalReturnUrl(): string;
  hasRevenueCatApiKey(): boolean;
}
