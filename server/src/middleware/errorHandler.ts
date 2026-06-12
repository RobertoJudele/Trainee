// server/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("💥 Unhandled Server Error:", err);

  // If headers have already been sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Sequelize validation errors
  if (err.name === "SequelizeValidationError" || err.name === "SequelizeUniqueConstraintError") {
    const fieldErrors = err.errors?.map((e: any) => ({
      field: e.path,
      message: e.message,
    })) || [];
    sendError(res, 400, err.message || "Database validation failed", fieldErrors);
    return;
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    sendError(res, 401, "Invalid authentication token");
    return;
  }
  if (err.name === "TokenExpiredError") {
    sendError(res, 401, "Authentication token has expired");
    return;
  }

  // Generic internal server error
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === "production" 
    ? "An unexpected error occurred. Please try again."
    : err.message || "Internal Server Error";

  sendError(res, statusCode, message);
};
