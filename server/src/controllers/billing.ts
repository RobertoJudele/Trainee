import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "../config/stripe";
import { Trainer } from "../models/trainer";
import { subStatus } from "../types/trainer";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";

const DEFAULT_WEB_SUCCESS_URL = "http://localhost:8081/checkout?success=true&session_id={CHECKOUT_SESSION_ID}";
const DEFAULT_WEB_CANCEL_URL = "http://localhost:8081/checkout?canceled=true";

const stripeApiVersion = "2024-04-10";

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
    trainer.subscriptionStatus = mapStripeStatusToLocal(stripeSubscription.status);
    trainer.trialEndsAt = resolveTrialEndsAt(stripeSubscription) ?? trainer.trialEndsAt;
    trainer.currentPeriodEndsAt = resolveCurrentPeriodEndsAt(stripeSubscription);
    await trainer.save();
};

export const createSubscription = async (req: AuthenticatedRequest, res: Response) => {
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

        const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID || process.env.STRIPE_PRICE_ID;
        if (!priceId) {
            sendError(res, 500, "Missing STRIPE_SUBSCRIPTION_PRICE_ID or STRIPE_PRICE_ID");
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

export const createCheckoutSession = async (req: Request, res: Response) => {
    try {
        const body = req.body as { lookup_key?: string; priceId?: string };
        const priceId = await getCheckoutPriceId(body?.lookup_key, body?.priceId);

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
                    const trainer = await Trainer.findOne({ where: { stripeSubscriptionId: subscriptionId } });
                    if (trainer) {
                        trainer.subscriptionStatus = subStatus.PAST;
                        await trainer.save();
                    }
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