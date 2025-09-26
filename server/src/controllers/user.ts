import { NextFunction, Request, Response } from "express";
import { User } from "../models/user";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";

export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user!.id;
    const { firstName, lastName, phone, profileImageUrl } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }

    await user.update({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      phone: phone || user.phone,
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
