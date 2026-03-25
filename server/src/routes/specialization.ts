import express from "express";
import {
	createSpecialization,
	getSpecializations,
} from "../controllers/specializations";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.get("/", getSpecializations);

router.use(authenticate);

router.post("/", createSpecialization);

export default router;
