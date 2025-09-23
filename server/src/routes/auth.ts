import express from "express";
import { getProfile, login, register } from "../controllers/auth";
import { authenticate } from "../middleware/auth";
import {
  handleValidationErrors,
  loginValidation,
  registerValidation,
} from "../middleware/validation";
const router = express.Router();
router.post("/register", registerValidation, handleValidationErrors, register);
router.post("/login", loginValidation, handleValidationErrors, login);
router.get("/profile", authenticate, getProfile);

export default router;
