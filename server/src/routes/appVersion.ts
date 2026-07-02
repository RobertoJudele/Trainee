import express from "express";
import { checkVersion } from "../controllers/appVersion";
import { publicReadRateLimit } from "../middleware/rateLimitProfiles";

const router = express.Router();

router.get("/check", publicReadRateLimit, checkVersion);

export default router;
