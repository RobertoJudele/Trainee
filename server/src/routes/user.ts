import express from "express";
import { updateProfile, deleteProfile } from "../controllers/user";
import { authenticate } from "../middleware/auth";
import { updateProfileValidation } from "../middleware/validation";

const router = express.Router();

router.use(authenticate);

router.put("/", updateProfileValidation, updateProfile);
router.delete("/", deleteProfile);

export default router;
