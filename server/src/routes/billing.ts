import express from "express";
import {
	createCheckoutSession,
	createPortalSession,
	createSubscription,
} from "../controllers/billing";
import { authenticate } from "../middleware/auth";

const router=express.Router();

router.post("/subscribe", authenticate, createSubscription);
router.post("/create-checkout-session", createCheckoutSession);
router.post("/create-portal-session", createPortalSession);

export default router;