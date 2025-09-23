import { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { ValidationError } from "sequelize";
import { UserRole } from "../types/common";
import { sendError } from "../utils/response";

export const registerValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Provide a valid email."),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long.")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  body("firstName")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 charachters long"),
  body("lastName")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 charachters long"),
  body("role").optional().isIn([UserRole.CLIENT, UserRole.TRAINER]),
  body("phone")
    .optional()
    .isMobilePhone("ro-RO")
    .withMessage("The phone number entered is invalid"),
];

export const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Provide a valid email."),
  body("password").notEmpty().withMessage("Password is required!"),
];

export const updateProfileValidation = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters."),
  body("lasstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters."),
  body("phone")
    .optional()
    .trim()
    .isMobilePhone("ro-RO")
    .withMessage("Invalid phone number"),
  body("profileImageUrl")
    .optional()
    .trim()
    .isURL()
    .withMessage("Profile image must be a valid URL"),
];

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.type === "field" ? error.path : "unknown",
      message: error.msg,
    }));
    sendError(res, 400, "Validation failed", formattedErrors);
    return;
  }
  next();
};
