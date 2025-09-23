import { NextFunction, Request, Response } from "express";
import { User } from "../models/user";
import { AuthenticatedRequest } from "../types/common";
import { verifyToken } from "../utils/jwt";
import { sendError } from "../utils/response";

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      sendError(res, 401, "User is not authenticated");
      return;
    }

    const decoded = verifyToken(token);

    const userId = decoded.userId;
    const user = await User.findByPk(userId);

    if (!user || !user.isActive) {
      sendError(res, 401, "User not authenticated");
      return;
    }

    //We need to remove the password before sending it to our app

    const userWithoutPassword = user.toJSON();

    req.user = userWithoutPassword;
    next();
  } catch (error: any) {
    if (error.name === "JsonWebTokenError") {
      sendError(res, 401, "Invalid token.");
      return;
    }
    if (error.name === "TokenExpiredError") {
      sendError(res, 401, "Token expired.");
      return;
    }
    sendError(res, 500, "Token verification failed.");
  }
};
