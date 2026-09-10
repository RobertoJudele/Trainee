import {
  BillingProvider,
  BillingState,
  Entitlement,
  IapPlatform,
  RevenueCatSnapshot,
  RevenueCatSubscriberData,
  RevenueCatWebhookEvent,
  subStatus,
  TransactionRecord,
} from "./types";

export interface Clock {
  now(): Date;
  nowMs(): number;
}

// RevenueCat reports granted entitlements with store and period_type PROMOTIONAL.
const PROMOTIONAL_STORE = "PROMOTIONAL";
const PERIOD_PROMOTIONAL = "promotional";

/** Free grant with no store purchase behind it — recorded as a running trial. */
export function applyPromotionalGrant(
  state: BillingState,
  grantedUntil: Date,
): BillingState {
  return {
    ...state,
    subscriptionStatus: subStatus.TRIAL,
    trialEndsAt: grantedUntil,
  };
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
        // A store trial carries its store as the provider; a running trial with
        // no provider at all is a promotional grant.
        isPromotional: state.billingProvider === BillingProvider.NONE,
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

// ── RevenueCat webhook payload normalization ────────────────────────

/**
 * RevenueCat sends webhook fields in snake_case (`app_user_id`,
 * `event_timestamp_ms`, …). Reading them as camelCase yields `undefined` for
 * every multi-word field, which then drops the event on the floor.
 *
 * This stayed invisible for a long time because `id` and `type` are single
 * words and match under either convention — so events were recorded and marked
 * processed while carrying no subscriber to act on. Both spellings are accepted
 * here so hand-written payloads and fixtures keep working.
 */
const toSnakeCase = (key: string): string =>
  key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function readField(raw: Record<string, unknown>, camelKey: string): unknown {
  const camel = raw[camelKey];
  return camel !== undefined ? camel : raw[toSnakeCase(camelKey)];
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  // Number(null) is 0 and Number("") is 0 — both would read as a real value.
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(asString).filter((s): s is string => Boolean(s));
  return items.length > 0 ? items : undefined;
}

/**
 * The v1 subscriber API is snake_case as well (`expires_date`,
 * `product_identifier`, `period_type`, `original_transaction_id`). `store` is
 * the only single-word field, which is why store-based detection kept working
 * while every dated field silently read as undefined — leaving a verified
 * entitlement with no expiry at all.
 */
export function normalizeRevenueCatSubscriber(raw: {
  entitlements?: unknown;
  subscriptions?: unknown;
}): RevenueCatSubscriberData {
  const mapEntries = <T>(
    src: unknown,
    map: (entry: Record<string, unknown>) => T,
  ): Record<string, T> => {
    const out: Record<string, T> = {};
    if (!src || typeof src !== "object") return out;
    for (const [key, value] of Object.entries(src as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        out[key] = map(value as Record<string, unknown>);
      }
    }
    return out;
  };

  return {
    entitlements: mapEntries(raw?.entitlements, (e) => ({
      expiresDate: asString(readField(e, "expiresDate")) ?? null,
      productIdentifier: asString(readField(e, "productIdentifier")) ?? null,
    })),
    subscriptions: mapEntries(raw?.subscriptions, (s) => ({
      expiresDate: asString(readField(s, "expiresDate")) ?? null,
      store: asString(readField(s, "store")) ?? null,
      originalTransactionId: asString(readField(s, "originalTransactionId")) ?? null,
      storeTransactionId: asString(readField(s, "storeTransactionId")) ?? null,
      purchaseDate: asString(readField(s, "purchaseDate")) ?? null,
      periodType: asString(readField(s, "periodType")) ?? null,
      priceInPurchasedCurrency: asNumber(readField(s, "priceInPurchasedCurrency")) ?? null,
      currency: asString(readField(s, "currency")) ?? null,
    })),
  };
}

export function normalizeRevenueCatEvent(
  raw: Record<string, unknown>,
): RevenueCatWebhookEvent {
  const read = (key: string) => readField(raw, key);
  return {
    id: asString(read("id")) ?? "",
    type: asString(read("type")) ?? "unknown",
    appUserId: asString(read("appUserId")),
    eventTimestampMs: asNumber(read("eventTimestampMs")),
    productId: asString(read("productId")),
    expirationAtMs: asNumber(read("expirationAtMs")),
    originalTransactionId: asString(read("originalTransactionId")),
    transactionId: asString(read("transactionId")),
    store: asString(read("store")),
    transferredFrom: asStringArray(read("transferredFrom")),
    transferredTo: asStringArray(read("transferredTo")),
    price: asNumber(read("price")),
    currency: asString(read("currency")),
  };
}

export function resolveRevenueCatSnapshot(
  data: RevenueCatSubscriberData,
  opts: {
    entitlementId: string;
    platform?: IapPlatform;
    fallbackProductId?: string;
    /**
     * Expiry to trust when RevenueCat's subscriber API has not caught up yet. Only
     * pass this from a RevenueCat-authenticated source (webhook events) — it can
     * activate an entitlement on its own. Never pass a value supplied by a client.
     */
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

  const store = String(subscription?.store ?? opts.fallbackStore ?? "").trim().toUpperCase();
  const isPromotional = store === PROMOTIONAL_STORE;
  const inferred = mapStoreToBillingProvider(store);
  // The platform fallback labels a real purchase whose store RevenueCat has not
  // reported yet. A promotional grant has no store at all, so letting it fall
  // through would stamp it "apple" purely because the caller happens to be on
  // iOS — which is what Restore Purchases does.
  const provider = isPromotional
    ? BillingProvider.NONE
    : inferred !== BillingProvider.NONE
      ? inferred
      : mapPlatformToProvider(opts.platform);

  // RevenueCat reports a null expiry for non-expiring (lifetime) entitlements, so a
  // missing date may only be read as "active" when RevenueCat actually returned a
  // record for this subscriber. With no entitlement and no subscription there is
  // nothing to verify against, and falling through to `!expiresAt` would hand out
  // open-ended access to anyone who can reach this code path.
  const hasRevenueCatRecord = Boolean(entitlement) || Boolean(subscription);
  const isActive = hasRevenueCatRecord
    ? !expiresAt || expiresAt.getTime() > opts.clock.nowMs()
    : Boolean(expiresAt && expiresAt.getTime() > opts.clock.nowMs());

  return {
    isActive,
    productId: productId ?? undefined,
    expiresAt,
    provider,
    originalTransactionId: subscription?.originalTransactionId ?? opts.fallbackOriginalTransactionId,
    // A granted (promotional) entitlement has no store subscription of its own,
    // so periodType can arrive empty — derive it from the store instead.
    periodType: isPromotional
      ? PERIOD_PROMOTIONAL
      : (subscription?.periodType ?? undefined),
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
  // Promotional grants ride the TRIAL branch of resolveEntitlement: it is the
  // only one that grants access without an Apple/Google/Stripe provider, which
  // a granted entitlement by definition does not have.
  const periodType = String(snapshot.periodType || "").trim().toLowerCase();
  const isPromotional = periodType === PERIOD_PROMOTIONAL;
  const isTrial = periodType === "trial" || isPromotional;

  // Same reasoning as in resolveRevenueCatSnapshot: a grant must keep provider
  // NONE, or resolveEntitlement stops reporting it as promotional and the app
  // shows "Trial Period, billed via Apple" for something Apple never sold.
  const provider = isPromotional
    ? BillingProvider.NONE
    : snapshot.provider !== BillingProvider.NONE
      ? snapshot.provider
      : mapPlatformToProvider(opts.platform) || state.billingProvider;

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
    // A granted entitlement was never paid for. Recording one as a paid
    // transaction would put a charge the trainer never made in their payment
    // history — don't rely on the missing-transaction-id check above for this.
    if (store === PERIOD_PROMOTIONAL) continue;

    // No inventing money. amount/currency are NOT NULL, so a transaction whose
    // real price RevenueCat did not report is skipped rather than recorded at a
    // made-up value; it can be backfilled from RevenueCat if it is ever needed.
    const amount = sub.priceInPurchasedCurrency;
    const currency = sub.currency;
    if (typeof amount !== "number" || !currency) continue;

    const provider = store === "app_store" ? "apple" : store === "play_store" ? "google" : "none";

    records.push({
      trainerId,
      amount,
      currency,
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
