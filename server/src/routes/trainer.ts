import express from "express";
import {
  createTrainer,
  deleteTrainer,
  getSelfTrainer,
  getTrainer,
  updateTrainer,
} from "../controllers/trainer";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.use(authenticate);

router.post("/create", createTrainer);
router.get("/:trainerId", getTrainer);
router.get("/", getSelfTrainer);
router.delete("/", deleteTrainer);
router.put("/", updateTrainer);

export default router;
