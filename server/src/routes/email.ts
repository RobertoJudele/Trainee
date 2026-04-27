import express from "express";
import {
  checkVerificationStatus,
  resendVerifyEmail,
  verifyEmail,
} from "../controllers/email";
import { authenticate } from "../middleware/auth";
import { emailPublicRateLimit } from "../middleware/rateLimitProfiles";
import {
  handleValidationErrors,
  resendVerificationValidation,
  verifyEmailValidation,
} from "../middleware/validation";

const router = express.Router();

router.get(
  "/verify",
  emailPublicRateLimit,
  verifyEmailValidation,
  handleValidationErrors,
  verifyEmail
);
router.post(
  "/resend",
  emailPublicRateLimit,
  resendVerificationValidation,
  handleValidationErrors,
  resendVerifyEmail
);
router.get("/status", authenticate, checkVerificationStatus);

export default router;
