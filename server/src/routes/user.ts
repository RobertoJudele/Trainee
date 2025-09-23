import express from "express";
import { updateProfile } from "../controllers/user";
import { authenticate } from "../middleware/auth";
import { updateProfileValidation } from "../middleware/validation";

const router = express.Router();

router.use(authenticate);

router.put("/profile", updateProfileValidation, updateProfile);

export default router;
