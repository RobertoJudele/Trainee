import express from "express";
import {
  getAllGyms,
  getGymById,
  getMyGyms,
  joinGym,
  setGymAvailability,
  leaveGym,
  createGym,
} from "../controllers/gym";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/authorization";
import { publicReadRateLimit } from "../middleware/rateLimitProfiles";
import {
  createGymValidation,
  gymAvailabilityValidation,
  gymIdParamValidation,
  gymListQueryValidation,
  handleValidationErrors,
} from "../middleware/validation";

const router = express.Router();

// Public routes (no auth needed to view gyms on map)
router.get(
  "/",
  publicReadRateLimit,
  gymListQueryValidation,
  handleValidationErrors,
  getAllGyms
);
router.get("/my-gyms", authenticate, getMyGyms);  // must come BEFORE /:gymId
router.get(
  "/:gymId",
  publicReadRateLimit,
  gymIdParamValidation,
  handleValidationErrors,
  getGymById
);

// Trainer routes
router.post(
  "/:gymId/join",
  authenticate,
  gymIdParamValidation,
  handleValidationErrors,
  joinGym
);
router.patch(
  "/:gymId/availability",
  authenticate,
  gymAvailabilityValidation,
  handleValidationErrors,
  setGymAvailability
);
router.delete(
  "/:gymId/leave",
  authenticate,
  gymIdParamValidation,
  handleValidationErrors,
  leaveGym
);

// Admin route
router.post(
  "/",
  authenticate,
  requireAdmin,
  createGymValidation,
  handleValidationErrors,
  createGym
);

export default router;