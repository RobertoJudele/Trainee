import express from "express";
import authRouter from "./auth";
import usersRouter from "./user";
import emailRouter from "./email";
import reviewRouter from "./review";
import trainerRouter from "./trainer";
import trainerImagesRouter from "./trainerImages";
import specializationRouter from "./specialization";
import trainerSpecializationRouter from "./trainerSpecialization";
import gymRouter from "./gym";
import billingRouter from "./billing";
import issueRouter from "./issue";
import trainerScheduleRouter from "./trainerSchedule";
import {
	createCheckoutSession,
	createPortalSession,
} from "../controllers/billing";

const router = express.Router();
router.use("/gyms", gymRouter);
router.use("/auth", authRouter);
router.use("/reviews", reviewRouter);
router.use("/users", usersRouter);
router.use("/email", emailRouter);
router.use("/trainer", trainerRouter);
router.use("/trainer-images", trainerImagesRouter);
router.use("/specialization", specializationRouter);
router.use("/trainer-specializations", trainerSpecializationRouter);
router.use("/billing", billingRouter);
router.use("/issues", issueRouter);
router.use("/trainer-schedule", trainerScheduleRouter);

// Backward-compatible paths used by the existing checkout screen.
router.post("/create-checkout-session", createCheckoutSession);
router.post("/create-portal-session", createPortalSession);

export default router;
