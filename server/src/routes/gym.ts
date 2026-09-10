import express from "express";
import {
  getAllGyms,
  getGymById,
  getMyGyms,
  joinGym,
  setGymAvailability,
  leaveGym,
  createGym,
  requestGymStaff,
  reviewGymStaff,
  listGymStaffRequests,
} from "../controllers/gym";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/authorization";
import { subscription } from "../middleware/subscription";
import { publicReadRateLimit } from "../middleware/rateLimitProfiles";
import {
  createGymValidation,
  gymAvailabilityValidation,
  gymIdParamValidation,
  gymListQueryValidation,
  gymStaffRequestValidation,
  gymStaffReviewValidation,
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
  "/staff-requests",
  authenticate,
  requireAdmin,
  listGymStaffRequests
);  // must come BEFORE /:gymId
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
  subscription,
  gymIdParamValidation,
  handleValidationErrors,
  joinGym
);
router.patch(
  "/:gymId/availability",
  authenticate,
  subscription,
  gymAvailabilityValidation,
  handleValidationErrors,
  setGymAvailability
);
router.post(
  "/:gymId/staff-request",
  authenticate,
  subscription,
  gymStaffRequestValidation,
  handleValidationErrors,
  requestGymStaff
);
router.delete(
  "/:gymId/leave",
  authenticate,
  gymIdParamValidation,
  handleValidationErrors,
  leaveGym
);

// Admin routes
router.patch(
  "/:gymId/staff-request/:trainerId",
  authenticate,
  requireAdmin,
  gymStaffReviewValidation,
  handleValidationErrors,
  reviewGymStaff
);
router.post(
  "/",
  authenticate,
  requireAdmin,
  createGymValidation,
  handleValidationErrors,
  createGym
);

export default router;