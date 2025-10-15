import express from "express";
import { createTrainerSpecialization } from "../controllers/trainerSpecialization";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.use(authenticate);

router.post("/", createTrainerSpecialization);

export default router;
