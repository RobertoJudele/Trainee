import Express from "express";
import { authenticate } from "../middleware/auth";
import { uploadImageMemory } from "../config/s3";
import {
  getTrainerTransformations,
  createTrainerTransformation,
  deleteTrainerTransformation,
} from "../controllers/trainerTransformations";

const router = Express.Router();

router.use(authenticate);

router.get("/", getTrainerTransformations);
router.post(
  "/",
  uploadImageMemory.fields([
    { name: "before", maxCount: 1 },
    { name: "after", maxCount: 1 },
  ]),
  createTrainerTransformation
);
router.delete("/:id", deleteTrainerTransformation);

export default router;
