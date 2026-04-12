import express from "express";
import {
	createCheckoutSession,
	createPortalSession,
	createSubscription,
	getBillingEntitlement,
	validateIapSubscription,
} from "../controllers/billing";
import { authenticate } from "../middleware/auth";

const router=express.Router();

router.post("/subscribe", authenticate, createSubscription);
router.get("/entitlement", authenticate, getBillingEntitlement);
router.post("/iap/validate", authenticate, validateIapSubscription);
router.post("/revenuecat/sync", authenticate, validateIapSubscription);
router.post("/create-checkout-session", createCheckoutSession);
router.post("/create-portal-session", createPortalSession);

export default router;