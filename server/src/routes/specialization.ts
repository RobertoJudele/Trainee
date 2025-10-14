import express from "express";
import { createSpecialization } from "../controllers/specializations";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.use(authenticate);

router.post("/", createSpecialization);

export default router;
