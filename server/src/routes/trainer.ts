import express from "express";
import { createTrainer } from "../controllers/trainer";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.post("/create", authenticate, createTrainer);

export default router;
