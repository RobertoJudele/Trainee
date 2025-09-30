import { url } from "inspector";
import { upload, uploadProfilePicture, generateS3key } from "../config/s3";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { Response } from "express";
import { User } from "../models/user";
import { S3ImageService } from "../services/s3ImageService";

interface S3File extends Express.Multer.File {
  key: string;
  bucket: string;
  acl: string;
  contentType: string;
  contentDisposition: string;
  storageClass: string;
  metadata: any;
  location: string;
  etag: string;
}

export const uploadTrainerProfilePicture = [
  upload.single("profileImage"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const file = req.file as S3File;

      if (!file) {
        sendError(res, 400, "No file uploaded");
        return;
      }

      const user = await User.findByPk(userId);
      if (!user) {
        // Added proper null check
        sendError(res, 404, "User not found");
        return;
      }

      if (user.profileImageUrl) {
        const oldKey = S3ImageService.extractKeyFromUrl(user.profileImageUrl);
        if (oldKey) {
          try {
            await S3ImageService.deleteImage(oldKey);
          } catch (error) {
            console.warn("Failed to delete old profile picture", error);
          }
        }
      }

      const s3Key = generateS3key(req, file, "profilePicture");

      const uploadResult = await S3ImageService.uploadImage(
        file.buffer,
        s3Key,
        file.mimetype
      );

      //image variants for better performance soon to be implemented

      await user.update({ profileImageUrl: uploadResult.url });

      sendSuccess(res, 200, "Profile picture uploaded succesfully", {
        user: user?.toJSON(),
        s3key: file.key,
        imageUrl: file.location,
      });
    } catch (error) {
      console.error(res, 400, "Profile picture upload error: ", error);
      sendError(res, 500, "Failed to upload profile picture");
    }
  },
];
