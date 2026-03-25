import express from "express";
import {
  forgotPassword,
  getProfile,
  login,
  register,
  resetPassword,
} from "../controllers/auth";
import { authenticate } from "../middleware/auth";
import {
  forgotPasswordValidation,
  handleValidationErrors,
  loginValidation,
  registerValidation,
  resetPasswordValidation,
} from "../middleware/validation";
const router = express.Router();
router.post("/register", registerValidation, handleValidationErrors, register);
router.post("/login", loginValidation, handleValidationErrors, login);
router.post(
  "/forgot-password",
  forgotPasswordValidation,
  handleValidationErrors,
  forgotPassword
);
router.post(
  "/reset-password",
  resetPasswordValidation,
  handleValidationErrors,
  resetPassword
);
router.get("/profile", authenticate, getProfile);

export default router;
