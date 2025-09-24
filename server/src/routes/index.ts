import express from "express";
import authRouter from "./auth";
import usersRouter from "./user";
import emailRouter from "./email";

const router = express.Router();

router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/email", emailRouter);
export default router;
