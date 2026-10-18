import express from "express";
import {
  createPosterCode,
  listPosterCodes,
  updatePosterCode,
} from "../controllers/posterCodes";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/authorization";
import {
  createPosterCodeValidation,
  handleValidationErrors,
  updatePosterCodeValidation,
} from "../middleware/validation";

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

router.post("/", createPosterCodeValidation, handleValidationErrors, createPosterCode);
router.get("/", listPosterCodes);
router.patch(
  "/:id",
  updatePosterCodeValidation,
  handleValidationErrors,
  updatePosterCode
);

export default router;
