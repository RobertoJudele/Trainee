import express from "express";
import {
  createTrainer,
  deleteTrainer,
  searchTrainers,
  getSelfTrainer,
  getTrainer,
  updateTrainer,
} from "../controllers/trainer";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.use(authenticate);

// server/src/routes/trainer.ts
router.get("/search", searchTrainers); // GET not POST - search params go in query string
router.post("/create", createTrainer);
router.get("/", getSelfTrainer);       // ⚠️ keep this AFTER /search or it won't match
router.get("/:trainerId", getTrainer);
router.delete("/", deleteTrainer);
router.put("/", updateTrainer);

export default router;
