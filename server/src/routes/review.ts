import express from "express";
import { createReview } from "../controllers/review";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.post("/review", authenticate, createReview);

export default router;
