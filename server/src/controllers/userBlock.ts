import { Request, Response } from "express";
import { UserBlock } from "../models/userBlock";
import { User } from "../models/user";
import { sendError, sendSuccess } from "../utils/response";

export const blockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 401, "User not authenticated");
      return;
    }

    const blockedUserId = Number(req.body?.blockedUserId);
    if (!Number.isFinite(blockedUserId) || blockedUserId <= 0) {
      sendError(res, 400, "A valid blockedUserId is required");
      return;
    }

    if (blockedUserId === user.id) {
      sendError(res, 400, "You cannot block yourself");
      return;
    }

    const target = await User.findByPk(blockedUserId);
    if (!target) {
      sendError(res, 404, "User not found");
      return;
    }

    await UserBlock.findOrCreate({
      where: { blockerId: user.id, blockedId: blockedUserId },
    });

    sendSuccess(res, 201, "User blocked");
  } catch (error) {
    console.error("Failed to block user:", error);
    sendError(res, 500, "Could not block user");
  }
};

export const unblockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 401, "User not authenticated");
      return;
    }

    const blockedUserId = Number(req.params.userId);
    if (!Number.isFinite(blockedUserId) || blockedUserId <= 0) {
      sendError(res, 400, "Invalid user id");
      return;
    }

    await UserBlock.destroy({
      where: { blockerId: user.id, blockedId: blockedUserId },
    });

    sendSuccess(res, 200, "User unblocked");
  } catch (error) {
    console.error("Failed to unblock user:", error);
    sendError(res, 500, "Could not unblock user");
  }
};

export const getBlockedUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 401, "User not authenticated");
      return;
    }

    const blocks = await UserBlock.findAll({
      where: { blockerId: user.id },
      include: [
        {
          model: User,
          as: "blocked",
          attributes: ["id", "firstName", "lastName", "profileImageUrl"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const data = blocks.map((block) => block.blocked).filter(Boolean);
    sendSuccess(res, 200, "Blocked users retrieved", data);
  } catch (error) {
    console.error("Failed to list blocked users:", error);
    sendError(res, 500, "Could not retrieve blocked users");
  }
};
