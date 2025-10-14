import express from "express";
import authRouter from "./auth";
import usersRouter from "./user";
import emailRouter from "./email";
import reviewRouter from "./review";
import trainerRouter from "./trainer";
import trainerImagesRouter from "./trainerImages";
import specializationRouter from "./specialization";
import trainerSpecializationRouter from "./specialization";

const router = express.Router();

router.use("/auth", authRouter);
router.use("/reviews", reviewRouter);
router.use("/users", usersRouter);
router.use("/email", emailRouter);
router.use("/trainer", trainerRouter);
router.use("/trainer-images", trainerImagesRouter);
router.use("/specialization", specializationRouter);
router.use("/trainer-specializations", trainerSpecializationRouter);
export default router;
