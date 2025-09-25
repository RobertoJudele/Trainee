import express from "express";
import { createTrainer } from "../controllers/trainer";

const router = express.Router();

router.post("/create", createTrainer);

export default router;
