import { NextFunction, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { ValidationError } from "sequelize";
import { UserRole } from "../types/common";
import { IssueCategory, IssueStatus, IssueTargetType } from "../types/issue";
import { sendError } from "../utils/response";

const getHostname = (value: string): string | null => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const matchesHost = (hostname: string, allowedHosts: string[]): boolean =>
  allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));

const normalizeWhatsAppPhoneDigits = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedPrefix = trimmed.startsWith("00")
    ? `+${trimmed.slice(2)}`
    : trimmed;

  const digits = normalizedPrefix.replace(/\D/g, "");
  if (!digits || digits.length < 7 || digits.length > 15) {
    return null;
  }

  if (!/^[1-9]/.test(digits)) {
    return null;
  }

  return digits;
};

const extractWhatsAppPhoneFromValue = (value: string): string | null => {
  const directPhone = normalizeWhatsAppPhoneDigits(value);
  if (directPhone) {
    return directPhone;
  }

  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname.toLowerCase();
    const fromQuery = parsed.searchParams.get("phone") ?? "";
    const fromPath = parsed.pathname.split("/").filter(Boolean)[0] ?? "";

    let phoneCandidate = "";
    if (hostname === "wa.me" || hostname.endsWith(".wa.me")) {
      phoneCandidate = fromPath;
    } else if (
      hostname === "api.whatsapp.com" ||
      hostname === "whatsapp.com" ||
      hostname === "www.whatsapp.com"
    ) {
      phoneCandidate = fromQuery;
    } else {
      return null;
    }

    return normalizeWhatsAppPhoneDigits(phoneCandidate);
  } catch {
    return null;
  }
};

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
  body("instagramUrl")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 255 })
    .withMessage("Instagram URL must be at most 255 characters.")
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("Instagram URL must be a valid http/https URL.")
    .custom((value) => {
      const hostname = getHostname(value);
      if (!hostname || !matchesHost(hostname, ["instagram.com"])) {
        throw new Error("Instagram URL must point to instagram.com.");
      }
      return true;
    }),
  body("facebookUrl")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 255 })
    .withMessage("Facebook URL must be at most 255 characters.")
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("Facebook URL must be a valid http/https URL.")
    .custom((value) => {
      const hostname = getHostname(value);
      if (!hostname || !matchesHost(hostname, ["facebook.com", "fb.com", "m.me"])) {
        throw new Error("Facebook URL must point to facebook.com, fb.com, or m.me.");
      }
      return true;
    }),
  body("whatsappUrl")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 255 })
    .withMessage("WhatsApp contact must be at most 255 characters.")
    .custom((value) => {
      const phoneDigits = extractWhatsAppPhoneFromValue(value);
      if (!phoneDigits) {
        throw new Error(
          "WhatsApp contact must be an international phone number (for example +40712345678) or a wa.me/api.whatsapp.com URL with a phone number."
        );
      }
      return true;
    }),
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
