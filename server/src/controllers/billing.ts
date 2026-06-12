import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "../config/stripe";
import { Trainer } from "../models/trainer";
import { BillingWebhookEvent } from "../models/billingWebhookEvent";
import { BillingTransaction } from "../models/billingTransaction";
import { BillingProvider, subStatus } from "../types/trainer";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { resolveTrainerEntitlement } from "../services/entitlement";
import { isStripeRuntimeEnabled } from "../config/billingMode";
import { BillingPlan, getBillingPlan, isBillingPlanId } from "../config/billingPlans";

const DEFAULT_WEB_SUCCESS_URL = "http://localhost:8081/checkout?success=true&session_id={CHECKOUT_SESSION_ID}";
const DEFAULT_WEB_CANCEL_URL = "http://localhost:8081/checkout?canceled=true";
const DEFAULT_REVENUECAT_API_URL = "https://api.revenuecat.com/v1";
const DEFAULT_REVENUECAT_ENTITLEMENT_ID = "trainer_subscription";
const STRIPE_RUNTIME_DISABLED_MESSAGE = "Stripe billing runtime is disabled for the current release mode.";

const stripeApiVersion = "2024-04-10";

interface ValidateIapSubscriptionRequest {
    platform: "ios" | "android";
    productId: string;
    purchaseToken?: string;
    expiresAt?: string | number;
    originalTransactionId?: string;
}

interface RevenueCatSubscriberEntitlement {
    expires_date?: string | null;
    product_identifier?: string | null;
}

interface RevenueCatSubscriberSubscription {
    expires_date?: string | null;
    store?: string | null;
    original_transaction_id?: string | null;
    store_transaction_id?: string | null;
    purchase_date?: string | null;
}

interface RevenueCatSubscriberPayload {
    subscriber?: {
        entitlements?: Record<string, RevenueCatSubscriberEntitlement>;
        subscriptions?: Record<string, RevenueCatSubscriberSubscription>;
    };
}

interface RevenueCatSnapshot {
    isActive: boolean;
    productId?: string;
    expiresAt?: Date;
    provider: BillingProvider;
    originalTransactionId?: string;
}

interface RevenueCatWebhookEnvelope {
    api_version?: string;
    event?: {
        id?: string;
        type?: string;
        app_user_id?: string;
        event_timestamp_ms?: number;
        product_id?: string;
        expiration_at_ms?: number | null;
        original_transaction_id?: string | null;
        transaction_id?: string | null;
        store?: string | null;
    };
}

const mapStripeStatusToLocal = (status: Stripe.Subscription.Status): subStatus => {
    if (status === "trialing") {
        return subStatus.TRIAL;
    }

    if (status === "active") {
        return subStatus.ACTIVE;
    }

    if (status === "past_due" || status === "incomplete") {
        return subStatus.PAST;
    }

    return subStatus.CANCELED;
};

const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const addRecurringInterval = (anchor: Date, interval: string, count: number) => {
    const next = new Date(anchor);
    if (interval === "day") {
        next.setDate(next.getDate() + count);
        return next;
    }

    if (interval === "week") {
        next.setDate(next.getDate() + (count * 7));
        return next;
    }

    if (interval === "year") {
        next.setFullYear(next.getFullYear() + count);
        return next;
    }

    next.setMonth(next.getMonth() + count);
    return next;
};

const mapIapPlatformToBillingProvider = (platform: "ios" | "android"): BillingProvider =>
    platform === "ios" ? BillingProvider.APPLE : BillingProvider.GOOGLE;

const parseIapExpiration = (value: string | number | undefined): Date | undefined => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) {
        const asMilliseconds = numeric > 9999999999 ? numeric : numeric * 1000;
        const byNumeric = new Date(asMilliseconds);
        if (Number.isFinite(byNumeric.getTime())) {
            return byNumeric;
        }
    }

    if (typeof value === "string") {
        const byString = new Date(value);
        if (Number.isFinite(byString.getTime())) {
            return byString;
        }
    }

    return undefined;
};

const parseRevenueCatIsoDate = (value?: string | null): Date | undefined => {
    if (!value) {
        return undefined;
    }

    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : undefined;
};

const parseRevenueCatMsDate = (value?: number | null): Date | undefined => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return undefined;
    }

    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : undefined;
};

const getRevenueCatApiBaseUrl = () =>
    process.env.REVENUECAT_API_URL?.trim() || DEFAULT_REVENUECAT_API_URL;

const getRevenueCatSecretApiKey = () =>
    process.env.REVENUECAT_SECRET_API_KEY?.trim() || "";

const getRevenueCatEntitlementId = () =>
    process.env.REVENUECAT_ENTITLEMENT_ID?.trim() || DEFAULT_REVENUECAT_ENTITLEMENT_ID;

const mapRevenueCatStoreToBillingProvider = (store?: string | null): BillingProvider => {
    const normalized = String(store || "").trim().toUpperCase();

    if (normalized === "APP_STORE" || normalized === "MAC_APP_STORE") {
        return BillingProvider.APPLE;
    }

    if (normalized === "PLAY_STORE") {
        return BillingProvider.GOOGLE;
    }

    if (normalized === "STRIPE" || normalized === "RC_BILLING") {
        return BillingProvider.STRIPE;
    }

    return BillingProvider.NONE;
};

const mapRevenueCatStoreToPlatform = (store?: string | null): "ios" | "android" | undefined => {
    const normalized = String(store || "").trim().toUpperCase();

    if (normalized === "APP_STORE" || normalized === "MAC_APP_STORE") {
        return "ios";
    }

    if (normalized === "PLAY_STORE") {
        return "android";
    }

    return undefined;
};

const ensureStripeRuntimeAvailable = (res: Response): boolean => {
    if (isStripeRuntimeEnabled()) {
        return true;
    }

    sendError(res, 503, STRIPE_RUNTIME_DISABLED_MESSAGE);
    return false;
};

const isRevenueCatWebhookAuthorized = (req: Request): boolean => {
    const expectedAuthorization = process.env.REVENUECAT_WEBHOOK_AUTH?.trim();
    if (!expectedAuthorization) {
        return true;
    }

    const providedAuthorization = req.headers.authorization;
    if (typeof providedAuthorization !== "string") {
        return false;
    }

    const normalizedProvided = providedAuthorization.trim();
    return (
        normalizedProvided === expectedAuthorization
        || normalizedProvided === `Bearer ${expectedAuthorization}`
    );
};

const fetchRevenueCatSubscriber = async (appUserId: string): Promise<RevenueCatSubscriberPayload> => {
    const apiKey = getRevenueCatSecretApiKey();
    if (!apiKey) {
        throw new Error("Missing REVENUECAT_SECRET_API_KEY");
    }

    const fetchImpl = (globalThis as any).fetch;
    if (typeof fetchImpl !== "function") {
        throw new Error("Global fetch is not available for RevenueCat API calls");
    }

    const endpoint = `${getRevenueCatApiBaseUrl()}/subscribers/${encodeURIComponent(appUserId)}`;
    const response = await fetchImpl(endpoint, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        const errorPayload = await response.text();
        throw new Error(`RevenueCat API request failed (${response.status}): ${errorPayload}`);
    }

    return (await response.json()) as RevenueCatSubscriberPayload;
};

const resolveRevenueCatSnapshot = (args: {
    payload: RevenueCatSubscriberPayload;
    platform?: "ios" | "android";
    fallbackProductId?: string;
    fallbackExpirationAt?: Date;
    fallbackStore?: string | null;
    fallbackOriginalTransactionId?: string;
}): RevenueCatSnapshot => {
    const {
        payload,
        platform,
        fallbackProductId,
        fallbackExpirationAt,
        fallbackStore,
        fallbackOriginalTransactionId,
    } = args;

    const entitlementId = getRevenueCatEntitlementId();
    const entitlements = payload.subscriber?.entitlements || {};
    const preferredEntitlement = entitlements[entitlementId];
    const firstEntitlement = Object.values(entitlements)[0];
    const entitlement = preferredEntitlement ?? firstEntitlement;

    const subscriptions = payload.subscriber?.subscriptions || {};
    const entitlementProductId = entitlement?.product_identifier || undefined;
    const productId = fallbackProductId || entitlementProductId || Object.keys(subscriptions)[0];
    const subscription = productId ? subscriptions[productId] : undefined;

    const entitlementExpiresAt = parseRevenueCatIsoDate(entitlement?.expires_date);
    const subscriptionExpiresAt = parseRevenueCatIsoDate(subscription?.expires_date);
    const expiresAt = entitlementExpiresAt ?? subscriptionExpiresAt ?? fallbackExpirationAt;

    const inferredProvider = mapRevenueCatStoreToBillingProvider(subscription?.store ?? fallbackStore);
    const provider = inferredProvider !== BillingProvider.NONE
        ? inferredProvider
        : (platform ? mapIapPlatformToBillingProvider(platform) : BillingProvider.NONE);

    const isActive = !expiresAt || expiresAt.getTime() > Date.now();

    return {
        isActive,
        productId,
        expiresAt,
        provider,
        originalTransactionId: subscription?.original_transaction_id || fallbackOriginalTransactionId,
    };
};

const applyRevenueCatSnapshotToTrainer = (args: {
    trainer: Trainer;
    snapshot: RevenueCatSnapshot;
    platform?: "ios" | "android";
    purchaseToken?: string;
    verifiedAt?: Date;
}) => {
    const { trainer, snapshot, platform, purchaseToken, verifiedAt } = args;

    const resolvedProvider = snapshot.provider !== BillingProvider.NONE
        ? snapshot.provider
        : (platform ? mapIapPlatformToBillingProvider(platform) : trainer.billingProvider as BillingProvider);

    trainer.billingProvider = resolvedProvider;
    trainer.iapProductId = snapshot.productId || trainer.iapProductId;
    trainer.iapLastVerifiedAt = verifiedAt || new Date();

    if (snapshot.expiresAt) {
        trainer.iapExpiresAt = snapshot.expiresAt;
        trainer.currentPeriodEndsAt = snapshot.expiresAt;
    }

    trainer.subscriptionStatus = snapshot.isActive ? subStatus.ACTIVE : subStatus.PAST;

    if (resolvedProvider === BillingProvider.APPLE && snapshot.originalTransactionId) {
        trainer.appleOriginalTransactionId = snapshot.originalTransactionId;
    }

    if (resolvedProvider === BillingProvider.GOOGLE && purchaseToken) {
        trainer.googlePurchaseToken = purchaseToken;
    }
};

const shouldIgnoreStaleRevenueCatEvent = (trainer: Trainer, eventTimestampMs?: number): boolean => {
    if (typeof eventTimestampMs !== "number" || !Number.isFinite(eventTimestampMs)) {
        return false;
    }

    if (!trainer.iapLastVerifiedAt) {
        return false;
    }

    return trainer.iapLastVerifiedAt.getTime() > eventTimestampMs;
};

const resolveCurrentPeriodEndsAt = (subscription: any): Date => {
    const directCurrentPeriodEnd = subscription?.current_period_end;
    if (typeof directCurrentPeriodEnd === "number" && Number.isFinite(directCurrentPeriodEnd)) {
        return new Date(directCurrentPeriodEnd * 1000);
    }

    const firstItem = subscription?.items?.data?.[0];
    const itemCurrentPeriodEnd = firstItem?.current_period_end;
    if (typeof itemCurrentPeriodEnd === "number" && Number.isFinite(itemCurrentPeriodEnd)) {
        return new Date(itemCurrentPeriodEnd * 1000);
    }

    const anchorUnix = subscription?.billing_cycle_anchor ?? subscription?.start_date ?? subscription?.created;
    if (typeof anchorUnix === "number" && Number.isFinite(anchorUnix)) {
        const anchorDate = new Date(anchorUnix * 1000);
        const recurring = firstItem?.price?.recurring;
        const interval = recurring?.interval ?? subscription?.plan?.interval ?? "month";
        const intervalCount = Number(recurring?.interval_count ?? subscription?.plan?.interval_count ?? 1);
        return addRecurringInterval(anchorDate, interval, Number.isFinite(intervalCount) && intervalCount > 0 ? intervalCount : 1);
    }

    return addDays(new Date(), 30);
};

const resolveTrialEndsAt = (subscription: any): Date | undefined => {
    const directTrialEnd = subscription?.trial_end;
    if (typeof directTrialEnd === "number" && Number.isFinite(directTrialEnd)) {
        return new Date(directTrialEnd * 1000);
    }

    return undefined;
};

// Resolve a plan (1m/3m/6m/12m) to a Stripe price id: explicit env override first,
// otherwise look it up by the plan's Stripe `lookup_key`.
const resolvePlanPriceId = async (plan: BillingPlan): Promise<string> => {
    const explicit = process.env[plan.envPriceIdVar]?.trim();
    if (explicit) {
        return explicit;
    }

    const prices = await stripe.prices.list({
        lookup_keys: [plan.lookupKey],
        active: true,
        limit: 1,
    });

    const priceId = prices.data[0]?.id;
    if (!priceId) {
        throw new Error(
            `No active Stripe price for plan ${plan.id} (set ${plan.envPriceIdVar} or a price with lookup_key "${plan.lookupKey}")`
        );
    }

    return priceId;
};

const getCheckoutPriceId = async (lookupKey?: string, explicitPriceId?: string) => {
    if (explicitPriceId) {
        return explicitPriceId;
    }

    if (lookupKey) {
        const prices = await stripe.prices.list({
            lookup_keys: [lookupKey],
            limit: 1,
        });

        if (prices.data.length > 0) {
            return prices.data[0].id;
        }
    }

    return process.env.STRIPE_SUBSCRIPTION_PRICE_ID || process.env.STRIPE_PRICE_ID;
};

const ensureTrainerStripeCustomer = async (trainer: Trainer, user: NonNullable<AuthenticatedRequest["user"]>) => {
    if (trainer.stripeCustomerId) {
        return trainer.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
            userId: String(user.id),
            trainerId: String(trainer.id),
        },
    });

    trainer.stripeCustomerId = customer.id;
    await trainer.save();

    return customer.id;
};

const resolveSubscriptionClientSecrets = async (subscription: Stripe.Subscription) => {
    let paymentIntentClientSecret: string | undefined;
    let setupIntentClientSecret: string | undefined;

    let latestInvoice: any = subscription.latest_invoice;

    if (typeof latestInvoice === "string") {
        latestInvoice = await stripe.invoices.retrieve(latestInvoice, {
            expand: ["payment_intent", "confirmation_secret"],
        } as any);
    }

    if (latestInvoice) {
        const paymentIntent = latestInvoice.payment_intent;
        if (typeof paymentIntent === "string") {
            const pi = await stripe.paymentIntents.retrieve(paymentIntent);
            paymentIntentClientSecret = pi.client_secret ?? undefined;
        } else if (paymentIntent?.client_secret) {
            paymentIntentClientSecret = paymentIntent.client_secret;
        }

        const confirmationSecret = latestInvoice.confirmation_secret?.client_secret;
        if (!paymentIntentClientSecret && confirmationSecret) {
            paymentIntentClientSecret = confirmationSecret;
        }
    }

    const pendingSetupIntent = (subscription as any).pending_setup_intent;
    if (typeof pendingSetupIntent === "string") {
        const setupIntent = await stripe.setupIntents.retrieve(pendingSetupIntent);
        setupIntentClientSecret = setupIntent.client_secret ?? undefined;
    } else if (pendingSetupIntent?.client_secret) {
        setupIntentClientSecret = pendingSetupIntent.client_secret;
    }

    return { paymentIntentClientSecret, setupIntentClientSecret };
};

const syncTrainerFromStripeSubscription = async (subscription: Stripe.Subscription) => {
    const stripeSubscription = subscription as any;
    const customerId = typeof stripeSubscription.customer === "string"
        ? stripeSubscription.customer
        : stripeSubscription.customer.id;

    const trainer = await Trainer.findOne({ where: { stripeCustomerId: customerId } });
    if (!trainer) {
        return;
    }

    trainer.stripeSubscriptionId = stripeSubscription.id;
    trainer.billingProvider = BillingProvider.STRIPE;
    trainer.subscriptionStatus = mapStripeStatusToLocal(stripeSubscription.status);
    trainer.trialEndsAt = resolveTrialEndsAt(stripeSubscription) ?? trainer.trialEndsAt;
    trainer.currentPeriodEndsAt = resolveCurrentPeriodEndsAt(stripeSubscription);
    await trainer.save();
};

export const createSubscription = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!ensureStripeRuntimeAvailable(res)) {
            return;
        }

        const user = req.user;
        if (!user) {
            sendError(res, 401, "User is not authenticated");
            return;
        }

        const trainer = await Trainer.findOne({ where: { userId: user.id } });
        if (!trainer) {
            sendError(res, 403, "You are not a trainer");
            return;
        }

        const requestedPlan = (req.body as { plan?: string } | undefined)?.plan;
        let priceId: string | undefined;

        if (requestedPlan) {
            if (!isBillingPlanId(requestedPlan)) {
                sendError(res, 400, "Invalid plan. Must be one of: 1m, 3m, 6m, 12m");
                return;
            }
            priceId = await resolvePlanPriceId(getBillingPlan(requestedPlan));
        } else {
            priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID || process.env.STRIPE_PRICE_ID;
        }

        if (!priceId) {
            sendError(res, 500, "No plan provided and no default STRIPE_SUBSCRIPTION_PRICE_ID / STRIPE_PRICE_ID configured");
            return;
        }

        const customerId = await ensureTrainerStripeCustomer(trainer, user);
        const trialPeriodDays = Number(process.env.STRIPE_TRIAL_DAYS || 30);
        const shouldApplyTrial = Number.isFinite(trialPeriodDays) && trialPeriodDays > 0;

        const ephemeralKey = await stripe.ephemeralKeys.create(
            { customer: customerId },
            { apiVersion: stripeApiVersion }
        );

        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: "default_incomplete",
            payment_settings: { save_default_payment_method: "on_subscription" },
            ...(shouldApplyTrial
                ? {
                    trial_period_days: trialPeriodDays,
                    trial_settings: {
                        end_behavior: {
                            missing_payment_method: "cancel" as const,
                        },
                    },
                }
                : {}),
            expand: ["latest_invoice.payment_intent", "latest_invoice.confirmation_secret", "pending_setup_intent"],
            metadata: {
                trainerId: String(trainer.id),
                userId: String(user.id),
            },
        });

        

        const { paymentIntentClientSecret, setupIntentClientSecret } = await resolveSubscriptionClientSecrets(subscription);

        if (!paymentIntentClientSecret && !setupIntentClientSecret) {
            sendError(res, 500, "Stripe did not return a payment or setup intent client secret");
            return;
        }

        trainer.stripeSubscriptionId = subscription.id;
        trainer.billingProvider = BillingProvider.STRIPE;
        trainer.subscriptionStatus = mapStripeStatusToLocal(subscription.status);
        trainer.trialEndsAt = resolveTrialEndsAt(subscription as any) ?? trainer.trialEndsAt;
        trainer.currentPeriodEndsAt = resolveCurrentPeriodEndsAt(subscription as any);
        await trainer.save();

        sendSuccess(res, 200, "Payment session created", {
            paymentIntent: paymentIntentClientSecret,
            setupIntent: setupIntentClientSecret,
            ephemeralKey: ephemeralKey.secret,
            customer: customerId,
            subscriptionId: subscription.id,
        });
    } catch (error) {
        console.error("Stripe mobile subscription creation failed:", error);
        sendError(res, 500, "Could not initialize subscription payment");
    }
};

export const getBillingEntitlement = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            sendError(res, 401, "User is not authenticated");
            return;
        }

        const trainer = await Trainer.findOne({ where: { userId: user.id } });
        if (!trainer) {
            sendError(res, 403, "You are not a trainer");
            return;
        }

        const entitlement = resolveTrainerEntitlement(trainer);
        sendSuccess(res, 200, "Billing entitlement retrieved", entitlement);
    } catch (error) {
        console.error("Billing entitlement retrieval failed:", error);
        sendError(res, 500, "Could not retrieve billing entitlement");
    }
};

export const validateIapSubscription = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            sendError(res, 401, "User is not authenticated");
            return;
        }

        const trainer = await Trainer.findOne({ where: { userId: user.id } });
        if (!trainer) {
            sendError(res, 403, "You are not a trainer");
            return;
        }

        if (!getRevenueCatSecretApiKey()) {
            sendError(res, 500, "Missing REVENUECAT_SECRET_API_KEY");
            return;
        }

        const {
            platform,
            productId,
            purchaseToken,
            expiresAt,
            originalTransactionId,
        } = req.body as ValidateIapSubscriptionRequest;

        if (platform !== "ios" && platform !== "android") {
            sendError(res, 400, "platform must be ios or android");
            return;
        }

        const normalizedProductId = String(productId || "").trim();
        const normalizedPurchaseToken = String(purchaseToken || "").trim();
        const normalizedOriginalTransactionId = String(originalTransactionId || "").trim();

        if (normalizedProductId.length < 3 || normalizedProductId.length > 120) {
            sendError(res, 400, "productId is invalid");
            return;
        }

        if (normalizedPurchaseToken.length > 500) {
            sendError(res, 400, "purchaseToken is invalid");
            return;
        }

        const fallbackExpiresAt = parseIapExpiration(expiresAt);
        const payload = await fetchRevenueCatSubscriber(String(user.id));
        const snapshot = resolveRevenueCatSnapshot({
            payload,
            platform,
            fallbackProductId: normalizedProductId,
            fallbackExpirationAt: fallbackExpiresAt,
            fallbackOriginalTransactionId: normalizedOriginalTransactionId || undefined,
        });

        applyRevenueCatSnapshotToTrainer({
            trainer,
            snapshot,
            platform,
            purchaseToken: normalizedPurchaseToken || undefined,
            verifiedAt: new Date(),
        });

        await trainer.save();

        const subscriptions = payload.subscriber?.subscriptions || {};
        for (const [productId, subDetails] of Object.entries(subscriptions)) {
            const txId = subDetails.store_transaction_id || subDetails.original_transaction_id;
            if (!txId) {
                continue;
            }

            const storeNormalized = String(subDetails.store || "").trim().toLowerCase();
            const providerName = storeNormalized === "app_store" ? "apple" : (storeNormalized === "play_store" ? "google" : "none");
            const paidAt = subDetails.purchase_date ? new Date(subDetails.purchase_date) : new Date();

            // Default amount to 100.00 RON
            const amount = 100.00;
            const currency = "RON";

            await BillingTransaction.findOrCreate({
                where: {
                    provider: providerName,
                    transactionId: txId,
                },
                defaults: {
                    trainerId: trainer.id,
                    amount,
                    currency,
                    status: "paid",
                    provider: providerName,
                    transactionId: txId,
                    productId,
                    paidAt,
                },
            });
        }

        const entitlement = resolveTrainerEntitlement(trainer);
        sendSuccess(res, 200, "IAP purchase validated", {
            entitlement,
            provider: trainer.billingProvider,
            iapProductId: trainer.iapProductId,
            iapExpiresAt: trainer.iapExpiresAt,
            iapLastVerifiedAt: trainer.iapLastVerifiedAt,
            placeholderValidation: false,
            validatedBy: "revenuecat",
        });
    } catch (error) {
        console.error("IAP validation failed:", error);
        sendError(res, 500, "Could not validate IAP subscription");
    }
};

const syncTrainerFromRevenueCatWebhookEvent = async (
    event: NonNullable<RevenueCatWebhookEnvelope["event"]>
) => {
    const numericUserId = Number(event.app_user_id);
    if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
        return { skipped: true, reason: "app_user_not_mapped" as const };
    }

    const trainer = await Trainer.findOne({ where: { userId: numericUserId } });
    if (!trainer) {
        return { skipped: true, reason: "trainer_not_found" as const };
    }

    if (shouldIgnoreStaleRevenueCatEvent(trainer, event.event_timestamp_ms)) {
        return { skipped: true, reason: "stale_event" as const };
    }

    const payload = await fetchRevenueCatSubscriber(String(numericUserId));
    const platform = mapRevenueCatStoreToPlatform(event.store);
    const snapshot = resolveRevenueCatSnapshot({
        payload,
        platform,
        fallbackProductId: String(event.product_id || "").trim() || undefined,
        fallbackExpirationAt: parseRevenueCatMsDate(event.expiration_at_ms),
        fallbackStore: event.store,
        fallbackOriginalTransactionId: String(event.original_transaction_id || "").trim() || undefined,
    });

    applyRevenueCatSnapshotToTrainer({
        trainer,
        snapshot,
        platform,
        purchaseToken: platform === "android"
            ? String(event.transaction_id || "").trim() || undefined
            : undefined,
        verifiedAt: typeof event.event_timestamp_ms === "number"
            ? new Date(event.event_timestamp_ms)
            : new Date(),
    });

    await trainer.save();

    const eventType = String(event.type).toUpperCase();
    if ((eventType === "INITIAL_PURCHASE" || eventType === "RENEWAL") && event.transaction_id) {
        const providerName = platform === "ios" ? "apple" : (platform === "android" ? "google" : "none");
        const rawEvent = event as any;
        const amount = Number(rawEvent.price_in_purchased_currency ?? rawEvent.price ?? 100.00);
        const currency = String(rawEvent.currency || "RON");

        await BillingTransaction.findOrCreate({
            where: {
                provider: providerName,
                transactionId: event.transaction_id,
            },
            defaults: {
                trainerId: trainer.id,
                amount,
                currency,
                status: "paid",
                provider: providerName,
                transactionId: event.transaction_id,
                productId: event.product_id || "unknown",
                paidAt: event.event_timestamp_ms ? new Date(event.event_timestamp_ms) : new Date(),
            },
        });
    }

    return { skipped: false as const, reason: "updated" as const };
};

export const revenueCatWebhook = async (req: Request, res: Response) => {
    try {
        if (!isRevenueCatWebhookAuthorized(req)) {
            res.status(401).json({ message: "Unauthorized RevenueCat webhook" });
            return;
        }

        const payload = req.body as RevenueCatWebhookEnvelope;
        const event = payload?.event;
        if (!event || typeof event !== "object") {
            res.status(400).json({ message: "Invalid RevenueCat webhook payload" });
            return;
        }

        const eventId = String(event.id || "").trim();
        if (!eventId) {
            res.status(400).json({ message: "RevenueCat webhook event id is required" });
            return;
        }

        const existingEvent = await BillingWebhookEvent.findOne({
            where: {
                source: "revenuecat",
                eventId,
            },
        });

        if (existingEvent?.processedAt) {
            res.status(200).json({ received: true, duplicate: true });
            return;
        }

        const webhookEvent = existingEvent || await BillingWebhookEvent.create({
            source: "revenuecat",
            eventId,
            eventType: String(event.type || "unknown"),
            appUserId: String(event.app_user_id || "").trim() || undefined,
            eventTimestampMs: typeof event.event_timestamp_ms === "number"
                ? event.event_timestamp_ms
                : undefined,
            payload: event as unknown as Record<string, unknown>,
        });

        webhookEvent.eventType = String(event.type || webhookEvent.eventType || "unknown");
        webhookEvent.appUserId = String(event.app_user_id || webhookEvent.appUserId || "").trim() || undefined;
        webhookEvent.eventTimestampMs = typeof event.event_timestamp_ms === "number"
            ? event.event_timestamp_ms
            : webhookEvent.eventTimestampMs;
        webhookEvent.payload = event as unknown as Record<string, unknown>;

        await syncTrainerFromRevenueCatWebhookEvent(event);

        webhookEvent.processedAt = new Date();
        await webhookEvent.save();

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("RevenueCat webhook handling failed:", error);
        res.status(500).json({ message: "Failed to process RevenueCat webhook" });
    }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
    try {
        if (!ensureStripeRuntimeAvailable(res)) {
            return;
        }

        const body = req.body as { lookup_key?: string; priceId?: string; plan?: string };

        let priceId: string | undefined;
        if (body?.plan) {
            if (!isBillingPlanId(body.plan)) {
                sendError(res, 400, "Invalid plan. Must be one of: 1m, 3m, 6m, 12m");
                return;
            }
            priceId = await resolvePlanPriceId(getBillingPlan(body.plan));
        } else {
            priceId = await getCheckoutPriceId(body?.lookup_key, body?.priceId);
        }

        if (!priceId) {
            sendError(res, 400, "No Stripe price id configured or provided");
            return;
        }

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: process.env.STRIPE_SUCCESS_URL || DEFAULT_WEB_SUCCESS_URL,
            cancel_url: process.env.STRIPE_CANCEL_URL || DEFAULT_WEB_CANCEL_URL,
            allow_promotion_codes: true,
        });

        sendSuccess(res, 200, "Checkout session created", {
            url: session.url,
            sessionId: session.id,
        });
    } catch (error) {
        console.error("Stripe checkout session creation failed:", error);
        sendError(res, 500, "Could not create checkout session");
    }
};

export const createPortalSession = async (req: Request, res: Response) => {
    try {
        if (!ensureStripeRuntimeAvailable(res)) {
            return;
        }

        const body = req.body as { session_id?: string; customerId?: string };
        let customerId = body.customerId;

        if (!customerId && body.session_id) {
            const checkoutSession = await stripe.checkout.sessions.retrieve(body.session_id);
            if (checkoutSession.customer) {
                customerId = typeof checkoutSession.customer === "string"
                    ? checkoutSession.customer
                    : checkoutSession.customer.id;
            }
        }

        if (!customerId) {
            sendError(res, 400, "A customer id or checkout session id is required");
            return;
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: process.env.STRIPE_PORTAL_RETURN_URL || process.env.STRIPE_SUCCESS_URL || DEFAULT_WEB_SUCCESS_URL,
        });

        sendSuccess(res, 200, "Billing portal session created", {
            url: portalSession.url,
        });
    } catch (error) {
        console.error("Stripe portal session creation failed:", error);
        sendError(res, 500, "Could not create billing portal session");
    }
};

export const stripeWebhook = async (req: Request, res: Response) => {
    if (!isStripeRuntimeEnabled()) {
        res.status(200).json({ received: true, ignored: true, reason: "stripe_runtime_disabled" });
        return;
    }

    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || typeof signature !== "string") {
        res.status(400).send("Missing Stripe signature header");
        return;
    }

    if (!webhookSecret) {
        res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
        return;
    }

    try {
        const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

        switch (event.type) {
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                await syncTrainerFromStripeSubscription(subscription);
                break;
            }
            case "customer.subscription.trial_will_end": {
                const subscription = event.data.object as Stripe.Subscription;
                await syncTrainerFromStripeSubscription(subscription);
                break;
            }
            case "invoice.payment_failed": {
                const invoice = event.data.object as any;
                if (invoice.subscription) {
                    const subscriptionId = typeof invoice.subscription === "string"
                        ? invoice.subscription
                        : invoice.subscription.id;
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    await syncTrainerFromStripeSubscription(subscription);
                }
                break;
            }
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.subscription) {
                    const subscriptionId = typeof session.subscription === "string"
                        ? session.subscription
                        : session.subscription.id;
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    await syncTrainerFromStripeSubscription(subscription);
                }
                break;
            }
            default:
                break;
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Stripe webhook handling failed:", error);
        res.status(400).send("Webhook signature verification failed");
    }
};

export const getBillingTransactions = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            sendError(res, 401, "User is not authenticated");
            return;
        }

        const trainer = await Trainer.findOne({ where: { userId: user.id } });
        if (!trainer) {
            sendError(res, 403, "You are not a trainer");
            return;
        }

        const transactions = await BillingTransaction.findAll({
            where: { trainerId: trainer.id },
            order: [["paidAt", "DESC"]],
        });

        sendSuccess(res, 200, "Billing transactions retrieved", transactions);
    } catch (error) {
        console.error("Failed to retrieve billing transactions:", error);
        sendError(res, 500, "Could not retrieve billing transactions");
    }
};