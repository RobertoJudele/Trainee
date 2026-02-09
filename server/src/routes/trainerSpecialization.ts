import express from "express";
import {
  createTrainerSpecialization,
  getAllTrainerSpecializations,
} from "../controllers/trainerSpecialization";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.use(authenticate);

router.post("/", createTrainerSpecialization);
router.get("/", getAllTrainerSpecializations);

export default router;
