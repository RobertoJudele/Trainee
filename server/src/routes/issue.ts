import express from "express";
import {
  createIssue,
  getMyIssues,
  listIssuesAdmin,
  updateIssueStatusAdmin,
} from "../controllers/issue";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/authorization";
import {
  createIssueValidation,
  handleValidationErrors,
  listIssuesAdminQueryValidation,
  updateIssueStatusValidation,
} from "../middleware/validation";

const router = express.Router();

router.use(authenticate);

router.post("/", createIssueValidation, handleValidationErrors, createIssue);
router.get("/me", getMyIssues);
router.get(
  "/",
  requireAdmin,
  listIssuesAdminQueryValidation,
  handleValidationErrors,
  listIssuesAdmin
);
router.patch(
  "/:issueId/status",
  requireAdmin,
  updateIssueStatusValidation,
  handleValidationErrors,
  updateIssueStatusAdmin
);

export default router;
