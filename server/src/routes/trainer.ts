import express from "express";
import {
  createTrainer,
  deleteTrainer,
  getTrainerAnalytics,
  searchTrainers,
  getSelfTrainer,
  getTrainer,
  updateTrainer,
} from "../controllers/trainer";
import { authenticate } from "../middleware/auth";
import {
  handleValidationErrors,
  trainerIdParamValidation,
  trainerSearchValidation,
  updateTrainerValidation,
} from "../middleware/validation";
import { subscription } from "../middleware/subscription";
import { publicReadRateLimit } from "../middleware/rateLimitProfiles";

const router = express.Router();

router.get(
  "/search",
  publicReadRateLimit,
  trainerSearchValidation,
  handleValidationErrors,
  searchTrainers
);
router.get("/analytics", authenticate, getTrainerAnalytics);
router.get(
  "/:trainerId",
  publicReadRateLimit,
  trainerIdParamValidation,
  handleValidationErrors,
  getTrainer
);
router.use(authenticate);

// server/src/routes/trainer.ts
 // GET not POST - search params go in query string
router.post(
  "/create",
  updateTrainerValidation,
  handleValidationErrors,
  createTrainer
);
router.get("/", getSelfTrainer);
router.delete("/", deleteTrainer);
router.put("/", updateTrainerValidation, handleValidationErrors, subscription, updateTrainer);

export default router;
