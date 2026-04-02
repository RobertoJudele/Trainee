import express from "express";
import {
  createIssue,
  getMyIssues,
  listIssuesAdmin,
  updateIssueStatusAdmin,
} from "../controllers/issue";
import { authenticate } from "../middleware/auth";
import {
  createIssueValidation,
  handleValidationErrors,
  updateIssueStatusValidation,
} from "../middleware/validation";

const router = express.Router();

router.use(authenticate);

router.post("/", createIssueValidation, handleValidationErrors, createIssue);
router.get("/me", getMyIssues);
router.get("/", listIssuesAdmin);
router.patch(
  "/:issueId/status",
  updateIssueStatusValidation,
  handleValidationErrors,
  updateIssueStatusAdmin
);

export default router;
