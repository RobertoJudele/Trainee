import express from "express";
import { suggestTrainers } from "../controllers/recommendation";
import { getMyPreferences, upsertMyPreferences } from "../controllers/clientPreference";
import { authenticate } from "../middleware/auth";
import {
  handleValidationErrors,
  suggestTrainersValidation,
  upsertClientPreferencesValidation,
} from "../middleware/validation";

const router = express.Router();

router.use(authenticate);

router.get("/preferences", getMyPreferences);
router.put(
  "/preferences",
  upsertClientPreferencesValidation,
  handleValidationErrors,
  upsertMyPreferences
);

router.get("/trainers", suggestTrainersValidation, handleValidationErrors, suggestTrainers);

export default router;
