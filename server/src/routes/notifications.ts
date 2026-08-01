import Express from "express";
import { authenticate } from "../middleware/auth";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "../controllers/notifications";
import {
  updateNotificationSettingsValidation,
  handleValidationErrors,
} from "../middleware/validation";

const router = Express.Router();

router.use(authenticate);

router.get("/settings", getNotificationSettings);
router.put(
  "/settings",
  updateNotificationSettingsValidation,
  handleValidationErrors,
  updateNotificationSettings
);

export default router;
