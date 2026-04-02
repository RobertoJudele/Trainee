import { NextFunction, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { ValidationError } from "sequelize";
import { UserRole } from "../types/common";
import { IssueCategory, IssueStatus, IssueTargetType } from "../types/issue";
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

export const forgotPasswordValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Provide a valid email."),
];

export const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Reset token is required."),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long.")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
];

export const updateProfileValidation = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters."),
  body("lastName")
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
    .custom((value) => {
      // Allow empty string or null (for deletion)
      if (value === "" || value === null || value === undefined) {
        return true;
      }
      // If not empty, must be valid URL
      const urlRegex = /^https?:\/\/.+/;
      if (!urlRegex.test(value)) {
        throw new Error("Profile image must be a valid URL");
      }
      return true;
    }),
];

export const updateTrainerValidation = [
  body("bio")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Bio must be at most 1000 characters."),
  body("experienceYears")
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage("Experience years must be between 0 and 50."),
  body("hourlyRate")
    .optional()
    .isFloat({ min: 0, max: 999.99 })
    .withMessage("Hourly rate must be between 0 and 999.99."),
  body("sessionRate")
    .optional()
    .isFloat({ min: 0, max: 999.99 })
    .withMessage("Session rate must be between 0 and 999.99."),
  body("locationCity")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("City must be between 2 and 100 characters."),
  body("locationState")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("State must be between 2 and 50 characters."),
  body("locationCountry")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Country must be between 2 and 50 characters."),
  body("latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90."),
  body("longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180."),
  body("specializationIds")
    .optional()
    .isArray()
    .withMessage("specializationIds must be an array."),
  body("specializationIds.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Each specialization id must be a positive integer."),
];

export const createIssueValidation = [
  body("targetType")
    .isIn(Object.values(IssueTargetType))
    .withMessage("targetType is invalid."),
  body("category")
    .isIn(Object.values(IssueCategory))
    .withMessage("category is invalid."),
  body("title")
    .trim()
    .isLength({ min: 5, max: 140 })
    .withMessage("Title must be between 5 and 140 characters."),
  body("description")
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters."),
  body("trainerId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("trainerId must be a positive integer."),
  body("bookingId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("bookingId must be a positive integer."),
];

export const updateIssueStatusValidation = [
  param("issueId")
    .isInt({ min: 1 })
    .withMessage("issueId must be a positive integer."),
  body("status")
    .isIn(Object.values(IssueStatus))
    .withMessage("status is invalid."),
  body("resolutionNote")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("resolutionNote must be at most 1000 characters."),
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
