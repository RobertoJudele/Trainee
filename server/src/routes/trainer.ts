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
import {
  handleValidationErrors,
  updateTrainerValidation,
} from "../middleware/validation";

const router = express.Router();

router.get("/search", searchTrainers);
router.get("/:trainerId", getTrainer);
router.use(authenticate);

// server/src/routes/trainer.ts
 // GET not POST - search params go in query string
router.post("/create", createTrainer);
router.get("/", getSelfTrainer);
router.delete("/", deleteTrainer);
router.put("/", updateTrainerValidation, handleValidationErrors, updateTrainer);

export default router;
