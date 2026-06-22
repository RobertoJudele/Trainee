import Stripe from "stripe";
import { BillingPlan } from "../../../config/billingPlans";
import {
  StripeCheckoutSession,
  StripePortalSession,
  StripeSubscriptionRaw,
  StripeSubscriptionSession,
  StripeWebhookEvent,
} from "../types";
import { StripeGateway } from "../ports";

const STRIPE_API_VERSION_FOR_EPHEMERAL_KEYS = "2024-04-10";

export class StripeSdkGateway implements StripeGateway {
  constructor(private readonly stripe: Stripe) {}

  async createCustomer(
    email: string,
    name: string,
    metadata: Record<string, string>,
  ): Promise<{ id: string }> {
    const customer = await this.stripe.customers.create({ email, name, metadata });
    return { id: customer.id };
  }

  async createEphemeralKey(
    customerId: string,
    apiVersion: string,
  ): Promise<{ secret: string }> {
    const key = await this.stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion },
    );
    return { secret: key.secret! };
  }

  async createSubscription(params: {
    customerId: string;
    priceId: string;
    trialDays?: number;
    metadata: Record<string, string>;
  }): Promise<StripeSubscriptionSession> {
    const shouldApplyTrial = params.trialDays && params.trialDays > 0;

    const ephemeralKey = await this.createEphemeralKey(
      params.customerId,
      STRIPE_API_VERSION_FOR_EPHEMERAL_KEYS,
    );

    const subscription = await this.stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      ...(shouldApplyTrial
        ? {
            trial_period_days: params.trialDays,
            trial_settings: {
              end_behavior: { missing_payment_method: "cancel" as const },
            },
          }
        : {}),
      expand: [
        "latest_invoice.payment_intent",
        "latest_invoice.confirmation_secret",
        "pending_setup_intent",
      ],
      metadata: params.metadata,
    });

    const { paymentIntentClientSecret, setupIntentClientSecret } =
      await this.resolveClientSecrets(subscription);

    return {
      paymentIntentClientSecret,
      setupIntentClientSecret,
      ephemeralKeySecret: ephemeralKey.secret,
      customerId: params.customerId,
      subscriptionId: subscription.id,
    };
  }

  async createCheckoutSession(params: {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<StripeCheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: true,
    });
    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<StripePortalSession> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
    return { url: session.url };
  }

  async retrieveCheckoutSession(sessionId: string): Promise<{ customerId: string | null }> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    const customerId = typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
    return { customerId };
  }

  async retrieveSubscription(subscriptionId: string): Promise<StripeSubscriptionRaw> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId) as any;
    const firstItem = sub.items?.data?.[0];
    const recurring = firstItem?.price?.recurring;

    return {
      id: sub.id,
      status: sub.status,
      customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      trialEnd: typeof sub.trial_end === "number" ? sub.trial_end : undefined,
      currentPeriodEnd: this.resolveCurrentPeriodEnd(sub),
      billingCycleAnchor: typeof sub.billing_cycle_anchor === "number"
        ? sub.billing_cycle_anchor : undefined,
      interval: recurring?.interval ?? sub.plan?.interval,
      intervalCount: Number(recurring?.interval_count ?? sub.plan?.interval_count ?? 1),
    };
  }

  async resolvePriceId(plan: BillingPlan): Promise<string> {
    const explicit = process.env[plan.envPriceIdVar]?.trim();
    if (explicit) return explicit;

    const prices = await this.stripe.prices.list({
      lookup_keys: [plan.lookupKey],
      active: true,
      limit: 1,
    });

    const priceId = prices.data[0]?.id;
    if (!priceId) {
      throw new Error(
        `No active Stripe price for plan ${plan.id} (set ${plan.envPriceIdVar} or a price with lookup_key "${plan.lookupKey}")`,
      );
    }
    return priceId;
  }

  async lookupPriceByKey(lookupKey: string): Promise<string | undefined> {
    const prices = await this.stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
    });
    return prices.data[0]?.id;
  }

  verifyWebhookSignature(
    payload: Buffer,
    signature: string,
    secret: string,
  ): StripeWebhookEvent {
    const event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    const obj = event.data.object as any;

    let subscriptionId: string | undefined;
    let invoiceSubscriptionId: string | undefined;
    let checkoutSubscriptionId: string | undefined;

    if (event.type.startsWith("customer.subscription.")) {
      subscriptionId = obj.id;
    } else if (event.type === "invoice.payment_failed") {
      const sub = obj.subscription;
      invoiceSubscriptionId = typeof sub === "string" ? sub : sub?.id;
    } else if (event.type === "checkout.session.completed") {
      const sub = obj.subscription;
      checkoutSubscriptionId = typeof sub === "string" ? sub : sub?.id;
    }

    return {
      type: event.type,
      data: {
        subscriptionId,
        customerId: typeof obj.customer === "string" ? obj.customer : obj.customer?.id,
        invoiceSubscriptionId,
        checkoutSubscriptionId,
      },
    };
  }

  private resolveCurrentPeriodEnd(sub: any): number | undefined {
    if (typeof sub.current_period_end === "number") return sub.current_period_end;

    const firstItem = sub.items?.data?.[0];
    if (typeof firstItem?.current_period_end === "number") return firstItem.current_period_end;

    const anchor = sub.billing_cycle_anchor ?? sub.start_date ?? sub.created;
    if (typeof anchor === "number") {
      const recurring = firstItem?.price?.recurring;
      const interval = recurring?.interval ?? sub.plan?.interval ?? "month";
      const count = Number(recurring?.interval_count ?? sub.plan?.interval_count ?? 1);
      const anchorDate = new Date(anchor * 1000);
      const next = new Date(anchorDate);

      if (interval === "day") next.setDate(next.getDate() + count);
      else if (interval === "week") next.setDate(next.getDate() + count * 7);
      else if (interval === "year") next.setFullYear(next.getFullYear() + count);
      else next.setMonth(next.getMonth() + count);

      return Math.floor(next.getTime() / 1000);
    }

    return Math.floor((Date.now() + 30 * 86400000) / 1000);
  }

  private async resolveClientSecrets(subscription: Stripe.Subscription): Promise<{
    paymentIntentClientSecret?: string;
    setupIntentClientSecret?: string;
  }> {
    let paymentIntentClientSecret: string | undefined;
    let setupIntentClientSecret: string | undefined;

    let latestInvoice: any = subscription.latest_invoice;
    if (typeof latestInvoice === "string") {
      latestInvoice = await this.stripe.invoices.retrieve(latestInvoice, {
        expand: ["payment_intent", "confirmation_secret"],
      } as any);
    }

    if (latestInvoice) {
      const paymentIntent = latestInvoice.payment_intent;
      if (typeof paymentIntent === "string") {
        const pi = await this.stripe.paymentIntents.retrieve(paymentIntent);
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
      const si = await this.stripe.setupIntents.retrieve(pendingSetupIntent);
      setupIntentClientSecret = si.client_secret ?? undefined;
    } else if (pendingSetupIntent?.client_secret) {
      setupIntentClientSecret = pendingSetupIntent.client_secret;
    }

    return { paymentIntentClientSecret, setupIntentClientSecret };
  }
}
