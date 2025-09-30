import Express from "express";
import { authenticate } from "../middleware/auth";
import {
  deleteTrainerProfilePicture,
  uploadTrainerProfilePicture,
} from "../controllers/trainerImages";

const router = Express.Router();

router.use(authenticate);

router.post("/profile-picture", uploadTrainerProfilePicture);
router.delete("/profile-picture", deleteTrainerProfilePicture);

export default router;
