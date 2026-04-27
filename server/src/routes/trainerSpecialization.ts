import express from "express";
import {
  createTrainerSpecialization,
  getAllTrainerSpecializations,
} from "../controllers/trainerSpecialization";
import { authenticate } from "../middleware/auth";
import {
  createTrainerSpecializationValidation,
  handleValidationErrors,
} from "../middleware/validation";

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  createTrainerSpecializationValidation,
  handleValidationErrors,
  createTrainerSpecialization
);
router.get("/", getAllTrainerSpecializations);

export default router;
