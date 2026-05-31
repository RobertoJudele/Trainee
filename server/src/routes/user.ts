import express from "express";
import { updateProfile, deleteProfile } from "../controllers/user";
import { authenticate } from "../middleware/auth";
import {
	handleValidationErrors,
	updateProfileValidation,
} from "../middleware/validation";

const router = express.Router();

router.use(authenticate);

router.put("/", updateProfileValidation, handleValidationErrors, updateProfile);
router.delete("/", deleteProfile);

export default router;
