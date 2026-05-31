import express from "express";
import {
	createSpecialization,
	getSpecializations,
} from "../controllers/specializations";
import { authenticate } from "../middleware/auth";
import { publicReadRateLimit } from "../middleware/rateLimitProfiles";
import {
	createSpecializationValidation,
	handleValidationErrors,
} from "../middleware/validation";

const router = express.Router();

router.get("/", publicReadRateLimit, getSpecializations);

router.use(authenticate);

router.post(
	"/",
	createSpecializationValidation,
	handleValidationErrors,
	createSpecialization
);

export default router;
