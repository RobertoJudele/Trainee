import Express from "express";
import { authenticate } from "../middleware/auth";
import { uploadTrainerProfilePicture } from "../controllers/trainerImages";

const router = Express.Router();

router.use(authenticate);

router.post("/profile-picture", uploadTrainerProfilePicture);

export default router;
