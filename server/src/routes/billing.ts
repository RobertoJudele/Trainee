import express from "express";
import {
	createCheckoutSession,
	createPortalSession,
	createSubscription,
	getBillingEntitlement,
	validateIapSubscription,
	getBillingTransactions,
} from "../controllers/billing";
import { authenticate } from "../middleware/auth";
import { checkoutRateLimit } from "../middleware/rateLimitProfiles";
import {
	createCheckoutSessionValidation,
	createPortalSessionValidation,
	createSubscriptionValidation,
	handleValidationErrors,
	validateIapSubscriptionValidation,
} from "../middleware/validation";

const router=express.Router();

router.post(
	"/subscribe",
	authenticate,
	createSubscriptionValidation,
	handleValidationErrors,
	createSubscription
);
router.get("/entitlement", authenticate, getBillingEntitlement);
router.get("/transactions", authenticate, getBillingTransactions);
router.post(
	"/iap/validate",
	authenticate,
	validateIapSubscriptionValidation,
	handleValidationErrors,
	validateIapSubscription
);
router.post(
	"/revenuecat/sync",
	authenticate,
	validateIapSubscriptionValidation,
	handleValidationErrors,
	validateIapSubscription
);
router.post(
	"/create-checkout-session",
	checkoutRateLimit,
	createCheckoutSessionValidation,
	handleValidationErrors,
	createCheckoutSession
);
router.post(
	"/create-portal-session",
	checkoutRateLimit,
	createPortalSessionValidation,
	handleValidationErrors,
	createPortalSession
);

export default router;