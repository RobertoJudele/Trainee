import {
  BillingProvider,
  BillingState,
  Entitlement,
  IapValidationInput,
  IapValidationResult,
  RevenueCatWebhookEvent,
  StripeCheckoutSession,
  StripePortalSession,
  StripeSubscriptionSession,
  subStatus,
  TransactionRecord,
} from "./types";
import {
  BillingStateRepository,
  TransactionRepository,
  WebhookEventRepository,
  StripeGateway,
  RevenueCatGateway,
  BillingConfig,
} from "./ports";
import * as domain from "./domain";
import { Clock } from "./domain";
import { BillingPlanId, getBillingPlan } from "../../config/billingPlans";

export class BillingError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHORIZED"
      | "INVALID_PAYLOAD"
      | "NOT_TRAINER"
      | "STRIPE_DISABLED"
      | "NO_PRICE"
      | "CONFIG_MISSING"
      | "NO_CLIENT_SECRET",
    message: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export class BillingService {
  constructor(
    private readonly billingRepo: BillingStateRepository,
    private readonly txRepo: TransactionRepository,
    private readonly webhookRepo: WebhookEventRepository,
    private readonly stripeGw: StripeGateway,
    private readonly revenueCatGw: RevenueCatGateway,
    private readonly config: BillingConfig,
    private readonly clock: Clock,
  ) {}

  // ── Entitlement ──────────────────────────────────────────────

  async getEntitlement(userId: number): Promise<Entitlement> {
    const state = await this.requireBillingState(userId);
    return domain.resolveEntitlement(state, {
      isRevenueCatOnly: this.config.isRevenueCatOnlyMode(),
      clock: this.clock,
    });
  }

  // ── IAP validation (RevenueCat) ──────────────────────────────

  async validateIapPurchase(
    userId: number,
    input: IapValidationInput,
  ): Promise<IapValidationResult> {
    const state = await this.requireBillingState(userId);

    if (!this.config.hasRevenueCatApiKey()) {
      throw new BillingError("CONFIG_MISSING", "Missing REVENUECAT_SECRET_API_KEY");
    }

    const subscriberData = await this.revenueCatGw.fetchSubscriber(String(userId));
    const snapshot = domain.resolveRevenueCatSnapshot(subscriberData, {
      entitlementId: this.config.getRevenueCatEntitlementId(),
      platform: input.platform,
      fallbackProductId: input.productId,
      fallbackExpiresAt: domain.parseIapExpiration(input.expiresAt),
      fallbackOriginalTransactionId: input.originalTransactionId,
      clock: this.clock,
    });

    const verifiedAt = this.clock.now();
    const updated = domain.applyRevenueCatSnapshot(state, snapshot, {
      platform: input.platform,
      purchaseToken: input.purchaseToken,
      verifiedAt,
    });

    await this.billingRepo.save(updated);

    const txRecords = domain.extractTransactionsFromRevenueCat(subscriberData, state.trainerId);
    for (const tx of txRecords) {
      await this.txRepo.findOrCreate(tx);
    }

    return {
      entitlement: domain.resolveEntitlement(updated, {
        isRevenueCatOnly: this.config.isRevenueCatOnlyMode(),
        clock: this.clock,
      }),
      provider: updated.billingProvider,
      iapProductId: updated.iapProductId,
      iapExpiresAt: updated.iapExpiresAt,
      iapLastVerifiedAt: verifiedAt,
    };
  }

  // ── Stripe mobile subscription ───────────────────────────────

  async createStripeSubscription(
    userId: number,
    email: string,
    name: string,
    plan?: BillingPlanId,
  ): Promise<StripeSubscriptionSession> {
    this.requireStripeEnabled();
    const state = await this.requireBillingState(userId);

    let priceId: string | undefined;
    if (plan) {
      priceId = await this.stripeGw.resolvePriceId(getBillingPlan(plan));
    } else {
      priceId = this.config.getDefaultPriceId();
    }

    if (!priceId) {
      throw new BillingError(
        "NO_PRICE",
        "No plan provided and no default STRIPE_SUBSCRIPTION_PRICE_ID / STRIPE_PRICE_ID configured",
      );
    }

    if (!state.stripeCustomerId) {
      const customer = await this.stripeGw.createCustomer(email, name, {
        userId: String(userId),
        trainerId: String(state.trainerId),
      });
      state.stripeCustomerId = customer.id;
      await this.billingRepo.save(state);
    }

    const session = await this.stripeGw.createSubscription({
      customerId: state.stripeCustomerId,
      priceId,
      trialDays: this.config.getStripeTrialDays(),
      metadata: { trainerId: String(state.trainerId), userId: String(userId) },
    });

    if (!session.paymentIntentClientSecret && !session.setupIntentClientSecret) {
      throw new BillingError(
        "NO_CLIENT_SECRET",
        "Stripe did not return a payment or setup intent client secret",
      );
    }

    return session;
  }

  // ── Stripe web checkout ──────────────────────────────────────

  async createCheckoutSession(opts: {
    plan?: string;
    lookupKey?: string;
    priceId?: string;
  }): Promise<StripeCheckoutSession> {
    this.requireStripeEnabled();

    let priceId: string | undefined;
    if (opts.plan) {
      priceId = await this.stripeGw.resolvePriceId(getBillingPlan(opts.plan as BillingPlanId));
    } else if (opts.priceId) {
      priceId = opts.priceId;
    } else if (opts.lookupKey) {
      priceId = await this.stripeGw.lookupPriceByKey(opts.lookupKey);
    }

    if (!priceId) {
      priceId = this.config.getDefaultPriceId();
    }

    if (!priceId) {
      throw new BillingError("NO_PRICE", "No Stripe price id configured or provided");
    }

    return this.stripeGw.createCheckoutSession({
      priceId,
      successUrl: this.config.getStripeSuccessUrl(),
      cancelUrl: this.config.getStripeCancelUrl(),
    });
  }

  // ── Stripe portal ────────────────────────────────────────────

  async createPortalSession(opts: {
    customerId?: string;
    sessionId?: string;
  }): Promise<StripePortalSession> {
    this.requireStripeEnabled();

    let customerId = opts.customerId;
    if (!customerId && opts.sessionId) {
      const session = await this.stripeGw.retrieveCheckoutSession(opts.sessionId);
      customerId = session.customerId ?? undefined;
    }

    if (!customerId) {
      throw new BillingError("INVALID_PAYLOAD", "A customer id or checkout session id is required");
    }

    return this.stripeGw.createPortalSession({
      customerId,
      returnUrl: this.config.getStripePortalReturnUrl(),
    });
  }

  // ── Stripe webhook ───────────────────────────────────────────

  async handleStripeWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: boolean; ignored?: boolean; reason?: string }> {
    if (!this.config.isStripeEnabled()) {
      return { received: true, ignored: true, reason: "stripe_runtime_disabled" };
    }

    const secret = this.config.getStripeWebhookSecret();
    if (!secret) {
      throw new BillingError("CONFIG_MISSING", "Missing STRIPE_WEBHOOK_SECRET");
    }

    const event = this.stripeGw.verifyWebhookSignature(rawBody, signature, secret);

    const subId = event.data.subscriptionId
      ?? event.data.invoiceSubscriptionId
      ?? event.data.checkoutSubscriptionId;

    if (!subId) return { received: true };

    const raw = await this.stripeGw.retrieveSubscription(subId);
    const state = await this.billingRepo.findByStripeCustomerId(raw.customerId);
    if (!state) return { received: true };

    const updated = domain.applyStripeSubscription(state, {
      id: raw.id,
      status: raw.status,
      trialEnd: raw.trialEnd,
      currentPeriodEnd: raw.currentPeriodEnd,
    });

    await this.billingRepo.save(updated);
    return { received: true };
  }

  // ── RevenueCat webhook ───────────────────────────────────────

  async handleRevenueCatWebhook(
    authHeader: string | undefined,
    payload: { event?: Partial<RevenueCatWebhookEvent> },
  ): Promise<{ received: boolean; duplicate?: boolean }> {
    if (!this.revenueCatGw.isWebhookAuthorized(authHeader)) {
      throw new BillingError("UNAUTHORIZED", "Unauthorized RevenueCat webhook");
    }

    const event = payload?.event;
    if (!event || typeof event !== "object") {
      throw new BillingError("INVALID_PAYLOAD", "Invalid RevenueCat webhook payload");
    }

    const eventId = String(event.id || "").trim();
    if (!eventId) {
      throw new BillingError("INVALID_PAYLOAD", "RevenueCat webhook event id is required");
    }

    const existing = await this.webhookRepo.findBySourceAndEventId("revenuecat", eventId);
    if (existing?.processedAt) {
      return { received: true, duplicate: true };
    }

    if (!existing) {
      await this.webhookRepo.create({
        source: "revenuecat",
        eventId,
        eventType: String(event.type || "unknown"),
        appUserId: String(event.appUserId || "").trim() || undefined,
        eventTimestampMs: typeof event.eventTimestampMs === "number"
          ? event.eventTimestampMs : undefined,
        payload: event as unknown as Record<string, unknown>,
      });
    }

    const normalizedEvent: RevenueCatWebhookEvent = {
      id: eventId,
      type: String(event.type || "unknown"),
      appUserId: event.appUserId,
      eventTimestampMs: event.eventTimestampMs,
      productId: event.productId,
      expirationAtMs: event.expirationAtMs,
      originalTransactionId: event.originalTransactionId,
      transactionId: event.transactionId,
      store: event.store,
      transferredFrom: event.transferredFrom,
      transferredTo: event.transferredTo,
      price: event.price,
      currency: event.currency,
    };

    if (String(event.type || "").toUpperCase() === "TRANSFER") {
      await this.handleTransfer(normalizedEvent);
    } else {
      await this.syncFromRevenueCatEvent(normalizedEvent);
    }

    await this.webhookRepo.markProcessed("revenuecat", eventId);
    return { received: true };
  }

  // ── Transactions ─────────────────────────────────────────────

  async getTransactions(userId: number): Promise<TransactionRecord[]> {
    const state = await this.requireBillingState(userId);
    return this.txRepo.findAllByTrainerId(state.trainerId);
  }

  // ── Private helpers ──────────────────────────────────────────

  private async requireBillingState(userId: number): Promise<BillingState> {
    const state = await this.billingRepo.findByUserId(userId);
    if (!state) throw new BillingError("NOT_TRAINER", "You are not a trainer");
    return state;
  }

  private requireStripeEnabled(): void {
    if (!this.config.isStripeEnabled()) {
      throw new BillingError(
        "STRIPE_DISABLED",
        "Stripe billing runtime is disabled for the current release mode.",
      );
    }
  }

  private async syncFromRevenueCatEvent(event: RevenueCatWebhookEvent): Promise<void> {
    const userId = Number(event.appUserId);
    if (!Number.isInteger(userId) || userId <= 0) return;

    const state = await this.billingRepo.findByUserId(userId);
    if (!state) return;
    if (domain.isStaleEvent(state, event.eventTimestampMs)) return;

    const data = await this.revenueCatGw.fetchSubscriber(String(userId));
    const platform = domain.mapStoreToPlatform(event.store);
    const snapshot = domain.resolveRevenueCatSnapshot(data, {
      entitlementId: this.config.getRevenueCatEntitlementId(),
      platform,
      fallbackProductId: String(event.productId || "").trim() || undefined,
      fallbackExpiresAt: event.expirationAtMs ? new Date(event.expirationAtMs) : undefined,
      fallbackStore: event.store,
      fallbackOriginalTransactionId: String(event.originalTransactionId || "").trim() || undefined,
      clock: this.clock,
    });

    const updated = domain.applyRevenueCatSnapshot(state, snapshot, {
      platform,
      purchaseToken: platform === "android"
        ? String(event.transactionId || "").trim() || undefined
        : undefined,
      verifiedAt: typeof event.eventTimestampMs === "number"
        ? new Date(event.eventTimestampMs)
        : this.clock.now(),
    });

    await this.billingRepo.save(updated);

    const eventType = String(event.type).toUpperCase();
    if ((eventType === "INITIAL_PURCHASE" || eventType === "RENEWAL") && event.transactionId) {
      const providerName = platform === "ios" ? "apple" : platform === "android" ? "google" : "none";
      await this.txRepo.findOrCreate({
        trainerId: state.trainerId,
        amount: event.price ?? 100.00,
        currency: event.currency || "RON",
        status: "paid",
        provider: providerName,
        transactionId: event.transactionId,
        productId: event.productId || "unknown",
        paidAt: event.eventTimestampMs ? new Date(event.eventTimestampMs) : this.clock.now(),
      });
    }
  }

  private async handleTransfer(event: RevenueCatWebhookEvent): Promise<void> {
    const ts = event.eventTimestampMs;

    for (const uid of event.transferredFrom ?? []) {
      const numId = Number(uid);
      if (!Number.isInteger(numId) || numId <= 0) continue;
      const state = await this.billingRepo.findByUserId(numId);
      if (!state || domain.isStaleEvent(state, ts)) continue;
      await this.billingRepo.save(
        domain.revokeEntitlement(state, ts ? new Date(ts) : this.clock.now()),
      );
    }

    for (const uid of event.transferredTo ?? []) {
      const numId = Number(uid);
      if (!Number.isInteger(numId) || numId <= 0) continue;
      const state = await this.billingRepo.findByUserId(numId);
      if (!state || domain.isStaleEvent(state, ts)) continue;
      const data = await this.revenueCatGw.fetchSubscriber(String(numId));
      const snapshot = domain.resolveRevenueCatSnapshot(data, {
        entitlementId: this.config.getRevenueCatEntitlementId(),
        clock: this.clock,
      });
      const updated = domain.applyRevenueCatSnapshot(state, snapshot, {
        verifiedAt: ts ? new Date(ts) : this.clock.now(),
      });
      await this.billingRepo.save(updated);
    }
  }
}
