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
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "JsonWebTokenError") {
      sendError(res, 401, "Invalid token.");
      return;
    }
    if (error instanceof Error && error.name === "TokenExpiredError") {
      sendError(res, 401, "Token expired.");
      return;
    }
    sendError(res, 500, "Token verification failed.");
  }
};

/**
 * Attaches req.user when a valid Bearer token is present, but never refuses
 * the request - for a route that must stay open to anonymous callers (public
 * search, a trainer's public reviews) while still personalising the result
 * for whichever caller happens to be logged in (e.g. excluding a user they've
 * blocked). A missing, invalid or expired token silently leaves req.user
 * unset rather than answering 401, unlike `authenticate`.
 */
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findByPk(decoded.userId);
    if (user && user.isActive) {
      req.user = user.toJSON();
    }
  } catch {
    // An invalid/expired token on an optional route is the same as no token.
  }

  next();
};
