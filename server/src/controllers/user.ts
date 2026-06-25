import { NextFunction, Request, Response } from "express";
import { User } from "../models/user";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { getSequelizeValidationErrors } from "../utils/errors";
import { uploadImageMemory, generateS3key } from "../config/s3";
import { S3ImageService } from "../services/s3ImageService";
import { processProfileImage } from "../services/imageProcessor";
import sequelize from "../db";
import { Trainer } from "../models/trainer";
import { RefreshToken } from "../models/refreshToken";
import { ClientPreference } from "../models/clientPreference";
import { ClientCheckInCode } from "../models/clientCheckInCode";
import { Review } from "../models/review";
import { Issue } from "../models/issue";
import { ProfileViewEvent } from "../models/profileViewEvent";
import { TrainerScheduleSlot } from "../models/trainerScheduleSlot";
import { cascadeDeleteTrainer } from "./trainer";

export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user!.id;
    const { firstName, lastName, phone, birthDate, sex, profileImageUrl } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }

    await user.update({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      phone: phone || user.phone,
      birthDate: birthDate ?? user.birthDate,
      sex: sex ?? user.sex,
      profileImageUrl: profileImageUrl || user.profileImageUrl,
    });

    sendSuccess(res, 200, "Profile updated succesfully!");
  } catch (error: unknown) {
    console.error("Update profile error:", error);
    const validationErrors = getSequelizeValidationErrors(error);
    if (validationErrors) {
      sendError(res, 400, "Validation failed", validationErrors);
      return;
    }
    sendError(res, 500, "Failed to update profile.");
  }
};

// POST /users/profile-picture — works for any authenticated user (client/trainer/admin).
// multer puts the raw file in memory, sharp squares it to 512x512 JPEG, then we
// upload to S3 and store the URL on User.profileImageUrl. The previous picture
// (if any) is deleted from S3 only after the new one uploads successfully.
export const uploadProfilePicture = [
  uploadImageMemory.single("profileImage"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const file = req.file;
      if (!file) {
        sendError(res, 400, "No file uploaded");
        return;
      }

      const user = await User.findByPk(userId);
      if (!user) {
        sendError(res, 404, "User not found");
        return;
      }

      const { buffer, contentType } = await processProfileImage(file.buffer, file.mimetype);
      const key = generateS3key(req, file, "profile-picture", "jpg");
      const uploadResult = await S3ImageService.uploadImage(buffer, key, contentType);

      const previousUrl = user.profileImageUrl;
      await user.update({ profileImageUrl: uploadResult.url });

      if (previousUrl) {
        const oldKey = S3ImageService.extractKeyFromUrl(previousUrl);
        if (oldKey && oldKey !== key) {
          try {
            await S3ImageService.deleteImage(oldKey);
          } catch (error) {
            console.warn("Failed to delete old profile picture:", error);
          }
        }
      }

      sendSuccess(res, 200, "Profile picture uploaded successfully", {
        user: user.toJSON(),
      });
    } catch (error) {
      console.error("Profile picture upload error:", error);
      sendError(res, 500, "Failed to upload profile picture");
    }
  },
];

// DELETE /users/profile-picture
export const deleteProfilePicture = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findByPk(req.user!.id);
    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }
    if (!user.profileImageUrl) {
      sendError(res, 400, "No profile picture to delete");
      return;
    }

    const key = S3ImageService.extractKeyFromUrl(user.profileImageUrl);
    if (key) {
      try {
        await S3ImageService.deleteImage(key);
      } catch (error) {
        console.warn("Failed to delete profile picture from S3:", error);
      }
    }

    await user.update({ profileImageUrl: null });
    sendSuccess(res, 200, "Profile picture deleted successfully", {
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Delete profile picture error:", error);
    sendError(res, 500, "Failed to delete profile picture");
  }
};

export const deleteProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }

    // Tear down everything that references the account, in one transaction, before
    // destroying the user row. ponytail: S3 images (profile picture, trainer gallery)
    // are not purged here — add a best-effort S3 sweep if orphaned objects matter.
    await sequelize.transaction(async (t) => {
      // The account's own trainer profile (if any) and all of its children.
      const trainer = await Trainer.findOne({ where: { userId }, transaction: t });
      if (trainer) await cascadeDeleteTrainer(trainer.id, t);

      // Rows this user owns as a client — delete outright.
      await RefreshToken.destroy({ where: { userId }, transaction: t });
      await ClientPreference.destroy({ where: { userId }, transaction: t });
      await ClientCheckInCode.destroy({ where: { clientId: userId }, transaction: t });
      // ponytail: bulk destroy skips Review's afterDestroy hook, so trainers this user
      // reviewed keep a slightly stale totalRating until their next review. Recompute the
      // affected trainers here if that drift matters.
      await Review.destroy({ where: { clientId: userId }, transaction: t });
      await Issue.destroy({ where: { reporterId: userId }, transaction: t });
      await ProfileViewEvent.destroy({ where: { viewerUserId: userId }, transaction: t });

      // Rows owned by others that merely point back at this user — keep the row, drop the link.
      await TrainerScheduleSlot.update(
        { clientId: null as unknown as undefined },
        { where: { clientId: userId }, transaction: t }
      );
      await ClientCheckInCode.update(
        { consumedByUserId: null },
        { where: { consumedByUserId: userId }, transaction: t }
      );
      await Issue.update(
        { resolvedBy: null as unknown as undefined },
        { where: { resolvedBy: userId }, transaction: t }
      );

      await user.destroy({ transaction: t });
    });

    sendSuccess(res, 200, "Succesfully deleted user");
  } catch (error: unknown) {
    console.error("Error while deleting profile: ", error);
    const validationErrors = getSequelizeValidationErrors(error);
    if (validationErrors) {
      sendError(res, 400, "Validation failed", validationErrors);
      return;
    }
    sendError(res, 500, "Unknown error while deleting user");
  }
};
