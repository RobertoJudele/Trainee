import express from "express";
import {
  createTrainer,
  deleteTrainer,
  getTrainer,
} from "../controllers/trainer";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.post("/create", authenticate, createTrainer);
router.get("/:trainerId", authenticate, getTrainer);
router.delete("/", authenticate, deleteTrainer);

export default router;
