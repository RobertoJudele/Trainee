import { RequestHandler } from "express";
import { UserRole } from "../types/common";
import { sendError } from "../utils/response";

export const requireRole = (...roles: UserRole[]): RequestHandler => {
  return (req, res, next): void => {
    const user = req.user;
    if (!user) {
      sendError(res, 401, "User is not authenticated");
      return;
    }

    if (!roles.includes(user.role)) {
      sendError(res, 403, "Insufficient permissions");
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(UserRole.ADMIN);
