import { Request, Response } from "express";
import { Op } from "sequelize";
import { Issue } from "../models/issue";
import { Trainer } from "../models/trainer";
import { User } from "../models/user";
import { UserRole } from "../types/common";
import {
  CreateIssueRequest,
  IssueCategory,
  IssueStatus,
  IssueTargetType,
  UpdateIssueStatusRequest,
} from "../types/issue";
import { sendError, sendSuccess } from "../utils/response";

const ensureAdmin = (req: Request, res: Response): boolean => {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    sendError(res, 403, "Admin access required");
    return false;
  }

  return true;
};

export const createIssue = async (
  req: Request<{}, {}, CreateIssueRequest>,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 401, "User not authenticated");
      return;
    }

    const {
      targetType,
      category,
      title,
      description,
      trainerId,
      trainerPublicId,
      bookingId,
      metadata,
    } = req.body;

    let resolvedTrainerId = trainerId;

    if (targetType === IssueTargetType.TRAINER) {
      if (!trainerId && !trainerPublicId) {
        sendError(res, 400, "trainerId or trainerPublicId is required for trainer reports");
        return;
      }

      let trainer: Trainer | null = null;

      if (trainerId) {
        trainer = await Trainer.findByPk(trainerId);
      }

      if (!trainer && trainerPublicId) {
        trainer = await Trainer.findOne({ where: { publicId: trainerPublicId } });
      }

      if (!trainer) {
        sendError(res, 404, "Trainer not found");
        return;
      }

      resolvedTrainerId = trainer.id;
    }

    if (targetType === IssueTargetType.BOOKING && !bookingId) {
      sendError(res, 400, "bookingId is required for booking reports");
      return;
    }

    if (targetType === IssueTargetType.APP && (trainerId || bookingId)) {
      sendError(res, 400, "App reports should not include trainerId or bookingId");
      return;
    }

    const duplicateWindowStart = new Date(Date.now() - 10 * 60 * 1000);
    const duplicateWhere: Record<string, unknown> = {
      reporterId: user.id,
      category,
      targetType,
      title: title.trim(),
      createdAt: { [Op.gte]: duplicateWindowStart },
    };

    if (typeof resolvedTrainerId === "number") {
      duplicateWhere.trainerId = resolvedTrainerId;
    }

    if (typeof bookingId === "number") {
      duplicateWhere.bookingId = bookingId;
    }

    const duplicate = await Issue.findOne({
      where: duplicateWhere,
    });

    if (duplicate) {
      sendError(res, 429, "A similar issue was already submitted recently");
      return;
    }

    const issue = await Issue.create({
      reporterId: user.id,
      targetType,
      category,
      title: title.trim(),
      description: description.trim(),
      trainerId: resolvedTrainerId,
      bookingId,
      metadata,
    });

    sendSuccess(res, 201, "Issue reported successfully", issue);
  } catch (error) {
    console.error("Failed to create issue:", error);
    sendError(res, 500, "Could not create issue");
  }
};

export const getMyIssues = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 401, "User not authenticated");
      return;
    }

    const issues = await Issue.findAll({
      where: { reporterId: user.id },
      order: [["createdAt", "DESC"]],
    });

    sendSuccess(res, 200, "Issues retrieved", issues);
  } catch (error) {
    console.error("Failed to get user issues:", error);
    sendError(res, 500, "Could not retrieve issues");
  }
};

export const listIssuesAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!ensureAdmin(req, res)) {
      return;
    }

    const status = req.query.status as IssueStatus | undefined;
    const category = req.query.category as IssueCategory | undefined;
    const targetType = req.query.targetType as IssueTargetType | undefined;

    const where: Record<string, unknown> = {};
    if (status && Object.values(IssueStatus).includes(status)) {
      where.status = status;
    }
    if (category && Object.values(IssueCategory).includes(category)) {
      where.category = category;
    }
    if (targetType && Object.values(IssueTargetType).includes(targetType)) {
      where.targetType = targetType;
    }

    const issues = await Issue.findAll({
      where,
      include: [
        { model: User, as: "reporter", attributes: ["id", "email", "firstName", "lastName"] },
        { model: Trainer, attributes: ["id", "userId"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    sendSuccess(res, 200, "Issues retrieved", issues);
  } catch (error) {
    console.error("Failed to list issues:", error);
    sendError(res, 500, "Could not retrieve issues");
  }
};

export const updateIssueStatusAdmin = async (
  req: Request<{ issueId: string }, {}, UpdateIssueStatusRequest>,
  res: Response
): Promise<void> => {
  try {
    if (!ensureAdmin(req, res)) {
      return;
    }

    const issueId = Number(req.params.issueId);
    if (!Number.isFinite(issueId) || issueId <= 0) {
      sendError(res, 400, "Invalid issue id");
      return;
    }

    const issue = await Issue.findByPk(issueId);
    if (!issue) {
      sendError(res, 404, "Issue not found");
      return;
    }

    const { status, resolutionNote } = req.body;

    issue.status = status;
    issue.resolutionNote = resolutionNote?.trim() || issue.resolutionNote;

    if (status === IssueStatus.RESOLVED || status === IssueStatus.REJECTED) {
      issue.resolvedAt = new Date();
      issue.resolvedBy = req.user?.id;
    }

    await issue.save();

    sendSuccess(res, 200, "Issue status updated", issue);
  } catch (error) {
    console.error("Failed to update issue:", error);
    sendError(res, 500, "Could not update issue status");
  }
};
