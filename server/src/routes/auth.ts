import express from "express";
import {
  forgotPassword,
  getProfile,
  login,
  register,
  resetPassword,
  refresh,
  socialAuth,
  socialAuthComplete,
} from "../controllers/auth";
import { authenticate } from "../middleware/auth";
import {
  forgotPasswordValidation,
  handleValidationErrors,
  loginValidation,
  registerValidation,
  resetPasswordValidation,
  socialAuthValidation,
  socialCompleteValidation,
} from "../middleware/validation";
import { authRateLimit } from "../middleware/rateLimitProfiles";
const router = express.Router();
router.post("/refresh", refresh);
router.post(
  "/register",
  authRateLimit,
  registerValidation,
  handleValidationErrors,
  register
);
router.post(
  "/login",
  authRateLimit,
  loginValidation,
  handleValidationErrors,
  login
);
router.post(
  "/forgot-password",
  authRateLimit,
  forgotPasswordValidation,
  handleValidationErrors,
  forgotPassword
);
router.post(
  "/reset-password",
  authRateLimit,
  resetPasswordValidation,
  handleValidationErrors,
  resetPassword
);
// Sign in with Google / Apple. authRateLimit keys by IP here: its
// identityExtractor reads req.body.email, which these bodies do not carry.
router.post(
  "/social",
  authRateLimit,
  socialAuthValidation,
  handleValidationErrors,
  socialAuth
);
router.post(
  "/social/complete",
  authRateLimit,
  socialCompleteValidation,
  handleValidationErrors,
  socialAuthComplete
);
router.get("/profile", authenticate, getProfile);

export default router;
