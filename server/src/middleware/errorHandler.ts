// server/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response";
import { getSequelizeValidationErrors } from "../utils/errors";

function getStatusCode(err: unknown): number {
  if (typeof err === "object" && err !== null) {
    const e = err as { statusCode?: unknown; status?: unknown };
    if (typeof e.statusCode === "number") return e.statusCode;
    if (typeof e.status === "number") return e.status;
  }
  return 500;
}

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("💥 Unhandled Server Error:", err);

  // If headers have already been sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Sequelize validation / unique-constraint errors
  const validationErrors = getSequelizeValidationErrors(err);
  if (validationErrors) {
    const message = err instanceof Error ? err.message : "Database validation failed";
    sendError(res, 400, message || "Database validation failed", validationErrors);
    return;
  }

  // Handle JWT errors
  if (err instanceof Error && err.name === "JsonWebTokenError") {
    sendError(res, 401, "Invalid authentication token");
    return;
  }
  if (err instanceof Error && err.name === "TokenExpiredError") {
    sendError(res, 401, "Authentication token has expired");
    return;
  }

  // Generic internal server error
  const statusCode = getStatusCode(err);
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred. Please try again."
      : err instanceof Error
        ? err.message || "Internal Server Error"
        : "Internal Server Error";

  sendError(res, statusCode, message);
};
