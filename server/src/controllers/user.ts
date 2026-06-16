import { NextFunction, Request, Response } from "express";
import { User } from "../models/user";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { uploadImageMemory, generateS3key } from "../config/s3";
import { S3ImageService } from "../services/s3ImageService";
import { processProfileImage } from "../services/imageProcessor";

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
  } catch (error: any) {
    console.error("Update profile error:", error);
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err: any) => ({
        field: err.path,
        message: err.message,
      }));
      sendError(res, 400, "Validation failed", errors);
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

    await user.destroy();

    sendSuccess(res, 200, "Succesfully deleted user");
  } catch (error: any) {
    console.error("Error while deleting profile: ", error);
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err: any) => ({
        fields: err.path,
        message: err.message,
      }));
      sendError(res, 400, errors);
      return;
    }
    sendError(res, 500, "Unknown error while deleting user");
  }
};
