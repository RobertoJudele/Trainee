import express from "express";
import {
  createReview,
  updateReview,
  deleteReview,
} from "../controllers/review";
import { authenticate } from "../middleware/auth";
import {
  createReviewValidation,
  deleteReviewValidation,
  handleValidationErrors,
  updateReviewValidation,
} from "../middleware/validation";

const router = express.Router();

// RESTful routes for reviews
router.post(
  "/:trainerId",
  authenticate,
  createReviewValidation,
  handleValidationErrors,
  createReview
); // Create review for trainer
// router.get("/:trainerId", getReviews); // Get all reviews for trainer
router.put(
  "/:reviewId",
  authenticate,
  updateReviewValidation,
  handleValidationErrors,
  updateReview
); // Update specific review
router.delete(
  "/:reviewId",
  authenticate,
  deleteReviewValidation,
  handleValidationErrors,
  deleteReview
); // Delete specific review

export default router;
