import {
  BillingProvider,
  BillingState,
  Entitlement,
  IapPlatform,
  RevenueCatSnapshot,
  RevenueCatSubscriberData,
  subStatus,
  TransactionRecord,
} from "./types";

export interface Clock {
  now(): Date;
  nowMs(): number;
}

// ── Entitlement resolution (single source of truth) ─────────────────

export function resolveEntitlement(
  state: BillingState,
  opts: { isRevenueCatOnly: boolean; clock: Clock },
): Entitlement {
  const now = opts.clock.nowMs();
  const hasFuture = (d?: Date) => Boolean(d && d.getTime() > now);

  if (state.subscriptionStatus === subStatus.PAST) {
    return {
      isActive: false,
      status: subStatus.PAST,
      source: state.billingProvider,
      expiresAt: state.currentPeriodEndsAt ?? state.iapExpiresAt ?? state.trialEndsAt,
      reason: "Subscription is past due.",
    };
  }

  if (state.subscriptionStatus === subStatus.CANCELED) {
    return {
      isActive: false,
      status: subStatus.CANCELED,
      source: state.billingProvider,
      expiresAt: state.currentPeriodEndsAt ?? state.iapExpiresAt ?? state.trialEndsAt,
      reason: "Subscription is canceled.",
    };
  }

  if (state.subscriptionStatus === subStatus.TRIAL) {
    if (hasFuture(state.trialEndsAt)) {
      return {
        isActive: true,
        status: subStatus.TRIAL,
        source: state.billingProvider,
        expiresAt: state.trialEndsAt,
      };
    }
    return {
      isActive: false,
      status: subStatus.PAST,
      source: state.billingProvider,
      expiresAt: state.trialEndsAt,
      reason: "Free trial ended.",
    };
  }

  if (state.billingProvider === BillingProvider.APPLE || state.billingProvider === BillingProvider.GOOGLE) {
    if (hasFuture(state.iapExpiresAt)) {
      return {
        isActive: true,
        status: subStatus.ACTIVE,
        source: state.billingProvider,
        expiresAt: state.iapExpiresAt,
      };
    }
    return {
      isActive: false,
      status: subStatus.PAST,
      source: state.billingProvider,
      expiresAt: state.iapExpiresAt,
      reason: "In-app purchase subscription expired.",
    };
  }

  if (state.billingProvider === BillingProvider.STRIPE) {
    if (opts.isRevenueCatOnly) {
      return {
        isActive: false,
        status: subStatus.CANCELED,
        source: BillingProvider.STRIPE,
        expiresAt: state.currentPeriodEndsAt,
        reason: "Stripe billing is currently disabled in runtime mode.",
      };
    }
    if (hasFuture(state.currentPeriodEndsAt) || !state.currentPeriodEndsAt) {
      return {
        isActive: true,
        status: subStatus.ACTIVE,
        source: BillingProvider.STRIPE,
        expiresAt: state.currentPeriodEndsAt,
      };
    }
    return {
      isActive: false,
      status: subStatus.PAST,
      source: BillingProvider.STRIPE,
      expiresAt: state.currentPeriodEndsAt,
      reason: "Stripe subscription period ended.",
    };
  }

  return {
    isActive: false,
    status: subStatus.CANCELED,
    source: BillingProvider.NONE,
    reason: "No active billing provider found.",
  };
}

// ── Stripe status mapping ───────────────────────────────────────────

export function mapStripeStatus(status: string): subStatus {
  if (status === "trialing") return subStatus.TRIAL;
  if (status === "active") return subStatus.ACTIVE;
  if (status === "past_due" || status === "incomplete") return subStatus.PAST;
  return subStatus.CANCELED;
}

// ── Apply Stripe subscription to billing state (immutable) ──────────

export function applyStripeSubscription(
  state: BillingState,
  raw: { id: string; status: string; trialEnd?: number; currentPeriodEnd?: number },
): BillingState {
  return {
    ...state,
    stripeSubscriptionId: raw.id,
    billingProvider: BillingProvider.STRIPE,
    subscriptionStatus: mapStripeStatus(raw.status),
    trialEndsAt: raw.trialEnd ? new Date(raw.trialEnd * 1000) : state.trialEndsAt,
    currentPeriodEndsAt: raw.currentPeriodEnd ? new Date(raw.currentPeriodEnd * 1000) : state.currentPeriodEndsAt,
  };
}

// ── RevenueCat snapshot resolution ──────────────────────────────────

function parseIsoDate(v?: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

function mapStoreToBillingProvider(store?: string | null): BillingProvider {
  const s = String(store || "").trim().toUpperCase();
  if (s === "APP_STORE" || s === "MAC_APP_STORE") return BillingProvider.APPLE;
  if (s === "PLAY_STORE") return BillingProvider.GOOGLE;
  if (s === "STRIPE" || s === "RC_BILLING") return BillingProvider.STRIPE;
  return BillingProvider.NONE;
}

function mapPlatformToProvider(platform?: IapPlatform): BillingProvider {
  if (platform === "ios") return BillingProvider.APPLE;
  if (platform === "android") return BillingProvider.GOOGLE;
  return BillingProvider.NONE;
}

export function mapStoreToPlatform(store?: string | null): IapPlatform | undefined {
  const s = String(store || "").trim().toUpperCase();
  if (s === "APP_STORE" || s === "MAC_APP_STORE") return "ios";
  if (s === "PLAY_STORE") return "android";
  return undefined;
}

export function resolveRevenueCatSnapshot(
  data: RevenueCatSubscriberData,
  opts: {
    entitlementId: string;
    platform?: IapPlatform;
    fallbackProductId?: string;
    fallbackExpiresAt?: Date;
    fallbackStore?: string;
    fallbackOriginalTransactionId?: string;
    clock: Clock;
  },
): RevenueCatSnapshot {
  const entitlement = data.entitlements[opts.entitlementId]
    ?? Object.values(data.entitlements)[0];

  const entitlementProductId = entitlement?.productIdentifier ?? undefined;
  const productId = opts.fallbackProductId || entitlementProductId || Object.keys(data.subscriptions)[0];
  const subscription = productId ? data.subscriptions[productId] : undefined;

  const expiresAt = parseIsoDate(entitlement?.expiresDate)
    ?? parseIsoDate(subscription?.expiresDate)
    ?? opts.fallbackExpiresAt;

  const inferred = mapStoreToBillingProvider(subscription?.store ?? opts.fallbackStore);
  const provider = inferred !== BillingProvider.NONE
    ? inferred
    : mapPlatformToProvider(opts.platform);

  const isActive = !expiresAt || expiresAt.getTime() > opts.clock.nowMs();

  return {
    isActive,
    productId: productId ?? undefined,
    expiresAt,
    provider,
    originalTransactionId: subscription?.originalTransactionId ?? opts.fallbackOriginalTransactionId,
    periodType: subscription?.periodType ?? undefined,
  };
}

// ── Apply RevenueCat snapshot to billing state (immutable) ──────────

export function applyRevenueCatSnapshot(
  state: BillingState,
  snapshot: RevenueCatSnapshot,
  opts: {
    platform?: IapPlatform;
    purchaseToken?: string;
    verifiedAt: Date;
  },
): BillingState {
  const provider = snapshot.provider !== BillingProvider.NONE
    ? snapshot.provider
    : mapPlatformToProvider(opts.platform) || state.billingProvider;

  const isTrial = String(snapshot.periodType || "").trim().toLowerCase() === "trial";

  let status: subStatus;
  if (!snapshot.isActive) {
    status = subStatus.PAST;
  } else if (isTrial) {
    status = subStatus.TRIAL;
  } else {
    status = subStatus.ACTIVE;
  }

  return {
    ...state,
    billingProvider: provider,
    subscriptionStatus: status,
    iapProductId: snapshot.productId || state.iapProductId,
    iapExpiresAt: snapshot.expiresAt ?? state.iapExpiresAt,
    currentPeriodEndsAt: snapshot.expiresAt ?? state.currentPeriodEndsAt,
    iapLastVerifiedAt: opts.verifiedAt,
    trialEndsAt: (isTrial && snapshot.expiresAt) ? snapshot.expiresAt : state.trialEndsAt,
    appleOriginalTransactionId:
      provider === BillingProvider.APPLE && snapshot.originalTransactionId
        ? snapshot.originalTransactionId
        : state.appleOriginalTransactionId,
    googlePurchaseToken:
      provider === BillingProvider.GOOGLE && opts.purchaseToken
        ? opts.purchaseToken
        : state.googlePurchaseToken,
  };
}

// ── Stale event detection ───────────────────────────────────────────

export function isStaleEvent(state: BillingState, eventTimestampMs?: number): boolean {
  if (typeof eventTimestampMs !== "number" || !Number.isFinite(eventTimestampMs)) return false;
  if (!state.iapLastVerifiedAt) return false;
  return state.iapLastVerifiedAt.getTime() > eventTimestampMs;
}

// ── Revoke entitlement (for transfers) ──────────────────────────────

export function revokeEntitlement(state: BillingState, revokedAt: Date): BillingState {
  return {
    ...state,
    subscriptionStatus: subStatus.PAST,
    iapExpiresAt: revokedAt,
    currentPeriodEndsAt: revokedAt,
    iapLastVerifiedAt: revokedAt,
  };
}

// ── Extract transactions from RevenueCat subscriber data ────────────

export function extractTransactionsFromRevenueCat(
  data: RevenueCatSubscriberData,
  trainerId: number,
): TransactionRecord[] {
  const records: TransactionRecord[] = [];
  for (const [productId, sub] of Object.entries(data.subscriptions)) {
    const txId = sub.storeTransactionId || sub.originalTransactionId;
    if (!txId) continue;

    const store = String(sub.store || "").trim().toLowerCase();
    const provider = store === "app_store" ? "apple" : store === "play_store" ? "google" : "none";

    records.push({
      trainerId,
      amount: 100.00,
      currency: "RON",
      status: "paid",
      provider,
      transactionId: txId,
      productId,
      paidAt: sub.purchaseDate ? new Date(sub.purchaseDate) : new Date(),
    });
  }
  return records;
}

// ── Parse IAP expiration (handles seconds, millis, ISO strings) ─────

export function parseIapExpiration(value?: string | number): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) {
    const asMs = numeric > 9999999999 ? numeric : numeric * 1000;
    const d = new Date(asMs);
    if (Number.isFinite(d.getTime())) return d;
  }

  if (typeof value === "string") {
    const d = new Date(value);
    if (Number.isFinite(d.getTime())) return d;
  }

  return undefined;
}
