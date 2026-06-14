import Express from "express";
import { authenticate } from "../middleware/auth";
import { uploadImageMemory } from "../config/s3";
import {
  getTrainerImages,
  uploadGalleryImages,
  uploadCredentialImages,
  deleteTrainerImage,
} from "../controllers/trainerImages";

const router = Express.Router();

router.use(authenticate);

router.get("/", getTrainerImages);
router.post("/gallery", uploadImageMemory.array("images", 5), uploadGalleryImages);
router.post("/credential", uploadImageMemory.array("images", 5), uploadCredentialImages);
router.delete("/:id", deleteTrainerImage);

export default router;
