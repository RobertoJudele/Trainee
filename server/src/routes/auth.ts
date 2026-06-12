import express from "express";
import {
  forgotPassword,
  getProfile,
  login,
  register,
  resetPassword,
  refresh,
} from "../controllers/auth";
import { authenticate } from "../middleware/auth";
import {
  forgotPasswordValidation,
  handleValidationErrors,
  loginValidation,
  registerValidation,
  resetPasswordValidation,
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
router.get("/profile", authenticate, getProfile);

export default router;
