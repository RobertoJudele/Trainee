import Express from "express";
import { authenticate } from "../middleware/auth";
import { subscription } from "../middleware/subscription";
import {
  getTrainerPackages,
  createTrainerPackage,
  updateTrainerPackage,
  deleteTrainerPackage,
} from "../controllers/trainerPackages";
import {
  createTrainerPackageValidation,
  updateTrainerPackageValidation,
  handleValidationErrors,
} from "../middleware/validation";

const router = Express.Router();

router.get("/:trainerId", getTrainerPackages);

router.use(authenticate);

router.post(
  "/",
  subscription,
  createTrainerPackageValidation,
  handleValidationErrors,
  createTrainerPackage
);
router.put(
  "/:id",
  subscription,
  updateTrainerPackageValidation,
  handleValidationErrors,
  updateTrainerPackage
);
router.delete("/:id", deleteTrainerPackage);

export default router;
