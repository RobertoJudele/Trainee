import express from "express";
import {
  createTrainer,
  deleteTrainer,
  getTrainerAnalytics,
  searchTrainers,
  getSelfTrainer,
  getTrainer,
  recordContact,
  updateTrainer,
} from "../controllers/trainer";
import { authenticate, optionalAuthenticate } from "../middleware/auth";
import {
  handleValidationErrors,
  trainerContactValidation,
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
  optionalAuthenticate,
  trainerSearchValidation,
  handleValidationErrors,
  searchTrainers
);
router.get("/analytics", authenticate, subscription, getTrainerAnalytics);
router.get(
  "/:trainerId",
  publicReadRateLimit,
  trainerIdParamValidation,
  handleValidationErrors,
  getTrainer
);
// The app reports taps on a trainer's WhatsApp / Instagram / Facebook buttons.
// Optional auth: a logged-in tapper is counted by user id, anyone else by IP.
router.post(
  "/:trainerId/contact",
  publicReadRateLimit,
  optionalAuthenticate,
  trainerContactValidation,
  handleValidationErrors,
  recordContact
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
