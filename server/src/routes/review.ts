import express from "express";
import { createReview } from "../controllers/review";
import { authenticate } from "../middleware/auth";

const router = express.Router();

// RESTful routes for reviews
router.post("/:trainerId", authenticate, createReview); // Create review for trainer
// router.get("/:trainerId", getReviews); // Get all reviews for trainer
// router.put("/:reviewId", authenticate, updateReview); // Update specific review
// router.delete("/:reviewId", authenticate, deleteReview); // Delete specific review

export default router;
