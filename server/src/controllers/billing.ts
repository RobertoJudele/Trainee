import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { billingService, BillingError } from "../services/billing";
import { isBillingPlanId, BillingPlanId } from "../config/billingPlans";

const mapBillingErrorStatus = (e: BillingError): number => {
  switch (e.code) {
    case "UNAUTHORIZED": return 401;
    case "NOT_TRAINER": return 403;
    case "INVALID_PAYLOAD": return 400;
    case "STRIPE_DISABLED": return 503;
    case "NO_PRICE": return 400;
    case "CONFIG_MISSING": return 500;
    case "NO_CLIENT_SECRET": return 500;
    default: return 500;
  }
};

export const createSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 401, "User is not authenticated");
      return;
    }

    const requestedPlan = (req.body as { plan?: string } | undefined)?.plan;
    if (requestedPlan && !isBillingPlanId(requestedPlan)) {
      sendError(res, 400, "Invalid plan. Must be one of: 1m, 3m, 6m, 12m");
      return;
    }

    const result = await billingService.createStripeSubscription(
      user.id,
      user.email,
      `${user.firstName} ${user.lastName}`,
      requestedPlan as BillingPlanId | undefined,
    );

    sendSuccess(res, 200, "Payment session created", {
      paymentIntent: result.paymentIntentClientSecret,
      setupIntent: result.setupIntentClientSecret,
      ephemeralKey: result.ephemeralKeySecret,
      customer: result.customerId,
      subscriptionId: result.subscriptionId,
    });
  } catch (error) {
    if (error instanceof BillingError) {
      sendError(res, mapBillingErrorStatus(error), error.message);
      return;
    }
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

    const entitlement = await billingService.getEntitlement(user.id);
    sendSuccess(res, 200, "Billing entitlement retrieved", entitlement);
  } catch (error) {
    if (error instanceof BillingError) {
      sendError(res, mapBillingErrorStatus(error), error.message);
      return;
    }
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

    const { platform, productId, purchaseToken, expiresAt, originalTransactionId } = req.body;

    if (platform !== "ios" && platform !== "android") {
      sendError(res, 400, "platform must be ios or android");
      return;
    }

    const normalizedProductId = String(productId || "").trim();
    if (normalizedProductId.length < 3 || normalizedProductId.length > 120) {
      sendError(res, 400, "productId is invalid");
      return;
    }

    const normalizedPurchaseToken = String(purchaseToken || "").trim();
    if (normalizedPurchaseToken.length > 500) {
      sendError(res, 400, "purchaseToken is invalid");
      return;
    }

    const result = await billingService.validateIapPurchase(user.id, {
      platform,
      productId: normalizedProductId,
      purchaseToken: normalizedPurchaseToken || undefined,
      expiresAt,
      originalTransactionId: String(originalTransactionId || "").trim() || undefined,
    });

    sendSuccess(res, 200, "IAP purchase validated", {
      entitlement: result.entitlement,
      provider: result.provider,
      iapProductId: result.iapProductId,
      iapExpiresAt: result.iapExpiresAt,
      iapLastVerifiedAt: result.iapLastVerifiedAt,
      placeholderValidation: false,
      validatedBy: "revenuecat",
    });
  } catch (error) {
    if (error instanceof BillingError) {
      sendError(res, mapBillingErrorStatus(error), error.message);
      return;
    }
    console.error("IAP validation failed:", error);
    sendError(res, 500, "Could not validate IAP subscription");
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const body = req.body as { lookup_key?: string; priceId?: string; plan?: string };

    if (body?.plan && !isBillingPlanId(body.plan)) {
      sendError(res, 400, "Invalid plan. Must be one of: 1m, 3m, 6m, 12m");
      return;
    }

    const result = await billingService.createCheckoutSession({
      plan: body?.plan,
      lookupKey: body?.lookup_key,
      priceId: body?.priceId,
    });

    sendSuccess(res, 200, "Checkout session created", {
      url: result.url,
      sessionId: result.sessionId,
    });
  } catch (error) {
    if (error instanceof BillingError) {
      sendError(res, mapBillingErrorStatus(error), error.message);
      return;
    }
    console.error("Stripe checkout session creation failed:", error);
    sendError(res, 500, "Could not create checkout session");
  }
};

export const createPortalSession = async (req: Request, res: Response) => {
  try {
    const body = req.body as { session_id?: string; customerId?: string };

    const result = await billingService.createPortalSession({
      customerId: body.customerId,
      sessionId: body.session_id,
    });

    sendSuccess(res, 200, "Billing portal session created", { url: result.url });
  } catch (error) {
    if (error instanceof BillingError) {
      sendError(res, mapBillingErrorStatus(error), error.message);
      return;
    }
    console.error("Stripe portal session creation failed:", error);
    sendError(res, 500, "Could not create billing portal session");
  }
};

export const stripeWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      res.status(400).send("Missing Stripe signature header");
      return;
    }

    const result = await billingService.handleStripeWebhook(req.body, signature);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof BillingError) {
      res.status(mapBillingErrorStatus(error)).json({ message: error.message });
      return;
    }
    console.error("Stripe webhook handling failed:", error);
    res.status(400).send("Webhook signature verification failed");
  }
};

export const revenueCatWebhook = async (req: Request, res: Response) => {
  try {
    const result = await billingService.handleRevenueCatWebhook(
      req.headers.authorization,
      req.body,
    );
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof BillingError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 400;
      res.status(status).json({ message: error.message });
      return;
    }
    console.error("RevenueCat webhook handling failed:", error);
    res.status(500).json({ message: "Failed to process RevenueCat webhook" });
  }
};

export const getBillingTransactions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 401, "User is not authenticated");
      return;
    }

    const transactions = await billingService.getTransactions(user.id);
    sendSuccess(res, 200, "Billing transactions retrieved", transactions);
  } catch (error) {
    if (error instanceof BillingError) {
      sendError(res, mapBillingErrorStatus(error), error.message);
      return;
    }
    console.error("Failed to retrieve billing transactions:", error);
    sendError(res, 500, "Could not retrieve billing transactions");
  }
};
