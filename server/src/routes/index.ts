import express from "express";
import authRouter from "./auth";
import usersRouter from "./user";
import emailRouter from "./email";
import reviewRouter from "./review";
import trainerRouter from "./trainer";
import trainerImagesRouter from "./trainerImages";

const router = express.Router();

router.use("/auth", authRouter);
router.use("/reviews", reviewRouter);
router.use("/users", usersRouter);
router.use("/email", emailRouter);
router.use("/trainer", trainerRouter);
router.use("/trainer-images", trainerImagesRouter);

export default router;
