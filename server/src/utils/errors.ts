import { ValidationError as SequelizeValidationError } from "sequelize";
import { ValidationError } from "../types/common";

/**
 * If `error` is a Sequelize validation or unique-constraint error, returns
 * the field-level messages in our API shape; otherwise returns `null`.
 * (Sequelize's `UniqueConstraintError` extends `ValidationError`, so both
 * are covered by the single `instanceof` check.)
 */
export function getSequelizeValidationErrors(
  error: unknown
): ValidationError[] | null {
  if (error instanceof SequelizeValidationError) {
    return error.errors.map((item) => ({
      field: item.path ?? "",
      message: item.message,
    }));
  }
  return null;
}

/** Best-effort extraction of a message from an unknown error. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}
