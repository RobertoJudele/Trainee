import express from "express";
import { blockUser, getBlockedUsers, unblockUser } from "../controllers/userBlock";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.use(authenticate);

router.get("/", getBlockedUsers);
router.post("/", blockUser);
router.delete("/:userId", unblockUser);

export default router;
