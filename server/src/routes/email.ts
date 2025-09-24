import express from "express";
import {
  checkVerificationStatus,
  resendVerifyEmail,
  verifyEmail,
} from "../controllers/email";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.get("/verify", verifyEmail);
router.post("/resend", resendVerifyEmail);
router.get("/status", authenticate, checkVerificationStatus);

export default router;
