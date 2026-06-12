import { NextFunction, Request, RequestHandler, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { securityConfig } from "../config/security";
import { UserRole } from "../types/common";
import { IssueCategory, IssueStatus, IssueTargetType } from "../types/issue";
import { sendError } from "../utils/response";

type SchemaLocation = "body" | "query" | "params";

interface StrictRequestSchema {
  body?: readonly string[];
  query?: readonly string[];
  params?: readonly string[];
}

interface StrictSchemaOptions {
  mode?: "monitor" | "enforce";
}

const KNOWN_SCHEMA_LOCATIONS: SchemaLocation[] = ["body", "query", "params"];

const getPayloadByLocation = (
  req: Request,
  location: SchemaLocation
): Record<string, unknown> => {
  const raw = req[location];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  return raw as Record<string, unknown>;
};

export const strictSchema = (
  schema: StrictRequestSchema,
  options?: StrictSchemaOptions
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const mode = options?.mode ?? securityConfig.unknownFieldMode;
    const strictErrors: Array<{ field: string; message: string }> = [];

    for (const location of KNOWN_SCHEMA_LOCATIONS) {
      const configuredFields = schema[location];
      if (configuredFields === undefined) {
        continue;
      }

      const allowed = new Set(configuredFields);

      const payload = getPayloadByLocation(req, location);
      const unexpectedFields = Object.keys(payload).filter((field) => !allowed.has(field));

      if (unexpectedFields.length === 0) {
        continue;
      }

      if (mode === "monitor") {
        console.warn(
          `[INPUT_MONITOR] ${req.method} ${req.originalUrl} unexpected ${location} fields: ${unexpectedFields.join(", ")}`
        );
        continue;
      }

      strictErrors.push(
        ...unexpectedFields.map((field) => ({
          field: `${location}.${field}`,
          message: "Unexpected field is not allowed",
        }))
      );
    }

    if (strictErrors.length > 0) {
      sendError(res, 400, "Validation failed", strictErrors);
      return;
    }

    next();
  };
};

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
  strictSchema({
    body: ["email", "password", "firstName", "lastName", "role", "phone"],
  }),
];

export const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Provide a valid email."),
  body("password").notEmpty().withMessage("Password is required!"),
  strictSchema({ body: ["email", "password"] }),
];

export const forgotPasswordValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Provide a valid email."),
  strictSchema({ body: ["email"] }),
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
  strictSchema({ body: ["token", "newPassword"] }),
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
  body("birthDate")
    .optional()
    .isISO8601()
    .withMessage("Birth date must be a valid ISO date."),
  body("sex")
    .optional()
    .isIn(["male", "female", "non_binary", "other", "prefer_not_to_say"])
    .withMessage("Sex must be one of the supported values."),
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
  strictSchema({
    body: [
      "firstName",
      "lastName",
      "phone",
      "birthDate",
      "sex",
      "profileImageUrl",
    ],
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
  strictSchema({
    body: [
      "bio",
      "experienceYears",
      "hourlyRate",
      "sessionRate",
      "locationCity",
      "locationState",
      "locationCountry",
      "latitude",
      "longitude",
      "instagramUrl",
      "facebookUrl",
      "whatsappUrl",
      "specializationIds",
    ],
  }),
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
  body("trainerPublicId")
    .optional()
    .isUUID()
    .withMessage("trainerPublicId must be a valid UUID."),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("metadata must be a valid object."),
  strictSchema({
    body: [
      "targetType",
      "category",
      "title",
      "description",
      "trainerId",
      "trainerPublicId",
      "bookingId",
      "metadata",
    ],
  }),
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
  strictSchema({
    params: ["issueId"],
    body: ["status", "resolutionNote"],
  }),
];

export const listIssuesAdminQueryValidation = [
  query("status")
    .optional()
    .isIn(Object.values(IssueStatus))
    .withMessage("status is invalid."),
  query("category")
    .optional()
    .isIn(Object.values(IssueCategory))
    .withMessage("category is invalid."),
  query("targetType")
    .optional()
    .isIn(Object.values(IssueTargetType))
    .withMessage("targetType is invalid."),
  strictSchema({ query: ["status", "category", "targetType"] }),
];

export const verifyEmailValidation = [
  query("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Provide a valid email."),
  query("token")
    .trim()
    .isLength({ min: 16, max: 512 })
    .withMessage("Token is invalid."),
  strictSchema({ query: ["email", "token"] }),
];

export const resendVerificationValidation = [
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Provide a valid email."),
  strictSchema({ body: ["email"] }),
];

export const gymListQueryValidation = [
  query("lat")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("lat must be between -90 and 90."),
  query("lng")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("lng must be between -180 and 180."),
  query("radiusKm")
    .optional()
    .isFloat({ min: 0.1, max: 200 })
    .withMessage("radiusKm must be between 0.1 and 200."),
  strictSchema({ query: ["lat", "lng", "radiusKm"] }),
];

export const gymIdParamValidation = [
  param("gymId")
    .isInt({ min: 1 })
    .withMessage("gymId must be a positive integer."),
  strictSchema({ params: ["gymId"], body: [], query: [] }),
];

export const gymAvailabilityValidation = [
  param("gymId")
    .isInt({ min: 1 })
    .withMessage("gymId must be a positive integer."),
  body("isAvailable")
    .isBoolean()
    .withMessage("isAvailable must be a boolean."),
  strictSchema({
    params: ["gymId"],
    body: ["isAvailable"],
  }),
];

export const createGymValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("name must be between 2 and 120 characters."),
  body("address")
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage("address must be between 5 and 255 characters."),
  body("city")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("city must be between 2 and 100 characters."),
  body("state")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("state must be between 2 and 100 characters."),
  body("country")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("country must be between 2 and 100 characters."),
  body("latitude")
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be between -90 and 90."),
  body("longitude")
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be between -180 and 180."),
  body("phone")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 30 })
    .withMessage("phone must be at most 30 characters."),
  body("openingHours")
    .optional({ values: "falsy" })
    .isLength({ max: 2000 })
    .withMessage("openingHours must be at most 2000 characters."),
  body("imageUrl")
    .optional({ values: "falsy" })
    .trim()
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("imageUrl must be a valid URL."),
  strictSchema({
    body: [
      "name",
      "address",
      "city",
      "state",
      "country",
      "latitude",
      "longitude",
      "phone",
      "openingHours",
      "imageUrl",
    ],
  }),
];

export const trainerIdParamValidation = [
  param("trainerId")
    .trim()
    .custom((value: string) => {
      const normalized = String(value || "").trim();
      const isNumeric = /^\d+$/.test(normalized) && Number(normalized) > 0;
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          normalized
        );

      if (!isNumeric && !isUuid) {
        throw new Error("trainerId must be a positive integer or UUID.");
      }

      return true;
    }),
  strictSchema({ params: ["trainerId"], body: [], query: [] }),
];

export const trainerSearchValidation = [
  query("q")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("q must be between 1 and 100 characters."),
  query("city")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("city must be between 1 and 100 characters."),
  query("state")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("state must be between 1 and 100 characters."),
  query("country")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("country must be between 1 and 100 characters."),
  query("lat")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("lat must be between -90 and 90."),
  query("lng")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("lng must be between -180 and 180."),
  query("radius")
    .optional()
    .isFloat({ min: 0.1, max: 500 })
    .withMessage("radius must be between 0.1 and 500."),
  query("radiusKm")
    .optional()
    .isFloat({ min: 0.1, max: 500 })
    .withMessage("radiusKm must be between 0.1 and 500."),
  query("minRate")
    .optional()
    .isFloat({ min: 0, max: 5000 })
    .withMessage("minRate must be between 0 and 5000."),
  query("maxRate")
    .optional()
    .isFloat({ min: 0, max: 5000 })
    .withMessage("maxRate must be between 0 and 5000."),
  query("rateType")
    .optional()
    .isIn(["hourly", "session"])
    .withMessage("rateType must be hourly or session."),
  query("minExperience")
    .optional()
    .isInt({ min: 0, max: 80 })
    .withMessage("minExperience must be between 0 and 80."),
  query("maxExperience")
    .optional()
    .isInt({ min: 0, max: 80 })
    .withMessage("maxExperience must be between 0 and 80."),
  query("minRating")
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage("minRating must be between 0 and 5."),
  query("specializations")
    .optional({ values: "falsy" })
    .matches(/^\d+(,\d+)*$/)
    .withMessage("specializations must be a comma-separated list of ids."),
  query("isAvailable")
    .optional()
    .isIn(["true", "false"])
    .withMessage("isAvailable must be true or false."),
  query("isFeatured")
    .optional()
    .isIn(["true", "false"])
    .withMessage("isFeatured must be true or false."),
  query("sortBy")
    .optional()
    .isIn([
      "totalRating",
      "experienceYears",
      "hourlyRate",
      "sessionRate",
      "reviewCount",
      "createdAt",
      "distance",
    ])
    .withMessage("sortBy is invalid."),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("sortOrder must be asc or desc."),
  query("page")
    .optional()
    .isInt({ min: 1, max: 100_000 })
    .withMessage("page must be a positive integer."),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100."),
  strictSchema({
    query: [
      "q",
      "city",
      "state",
      "country",
      "lat",
      "lng",
      "radius",
      "radiusKm",
      "minRate",
      "maxRate",
      "rateType",
      "minExperience",
      "maxExperience",
      "minRating",
      "specializations",
      "isAvailable",
      "isFeatured",
      "sortBy",
      "sortOrder",
      "page",
      "limit",
    ],
  }),
];

export const createReviewValidation = [
  param("trainerId")
    .isInt({ min: 1 })
    .withMessage("trainerId must be a positive integer."),
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("rating must be between 1 and 5."),
  body("reviewText")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 5, max: 2000 })
    .withMessage("reviewText must be between 5 and 2000 characters."),
  strictSchema({
    params: ["trainerId"],
    body: ["rating", "reviewText"],
  }),
];

export const updateReviewValidation = [
  param("reviewId")
    .isInt({ min: 1 })
    .withMessage("reviewId must be a positive integer."),
  body("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("rating must be between 1 and 5."),
  body("reviewText")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 5, max: 2000 })
    .withMessage("reviewText must be between 5 and 2000 characters."),
  strictSchema({
    params: ["reviewId"],
    body: ["rating", "reviewText"],
  }),
];

export const deleteReviewValidation = [
  param("reviewId")
    .isInt({ min: 1 })
    .withMessage("reviewId must be a positive integer."),
  strictSchema({ params: ["reviewId"], body: [], query: [] }),
];

export const createSpecializationValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("name must be between 2 and 100 characters."),
  body("description")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("description must be at most 500 characters."),
  body("iconUrl")
    .optional({ values: "falsy" })
    .trim()
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("iconUrl must be a valid URL."),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean."),
  strictSchema({ body: ["name", "description", "iconUrl", "isActive"] }),
];

export const createTrainerSpecializationValidation = [
  body("specializations")
    .isArray({ min: 1, max: 50 })
    .withMessage("specializations must be a non-empty array."),
  body("specializations.*.specializationId")
    .isInt({ min: 1 })
    .withMessage("specializationId must be a positive integer."),
  body("specializations.*.experienceLevel")
    .optional({ values: "falsy" })
    .isIn(["beginner", "intermediate", "expert"])
    .withMessage("experienceLevel must be beginner, intermediate or expert."),
  body("specializations.*.certification")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 255 })
    .withMessage("certification must be at most 255 characters."),
  strictSchema({ body: ["specializations"] }),
];

export const createCheckoutSessionValidation = [
  body("lookup_key")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("lookup_key must be between 2 and 120 characters."),
  body("priceId")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage("priceId must be between 2 and 255 characters."),
  strictSchema({ body: ["lookup_key", "priceId"] }),
];

export const createPortalSessionValidation = [
  body("session_id")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage("session_id is invalid."),
  body("customerId")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage("customerId is invalid."),
  body().custom((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Request body is required.");
    }

    const payload = value as { session_id?: string; customerId?: string };
    const hasSessionId =
      typeof payload.session_id === "string" && payload.session_id.trim().length > 0;
    const hasCustomerId =
      typeof payload.customerId === "string" && payload.customerId.trim().length > 0;

    if (!hasSessionId && !hasCustomerId) {
      throw new Error("Provide either session_id or customerId.");
    }

    return true;
  }),
  strictSchema({ body: ["session_id", "customerId"] }),
];

export const validateIapSubscriptionValidation = [
  body("platform")
    .isIn(["ios", "android"])
    .withMessage("platform must be ios or android."),
  body("productId")
    .trim()
    .isLength({ min: 3, max: 120 })
    .withMessage("productId is invalid."),
  body("purchaseToken")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("purchaseToken is invalid."),
  body("expiresAt")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === "") {
        return true;
      }

      if (typeof value === "number" && Number.isFinite(value)) {
        return true;
      }

      if (typeof value === "string") {
        const asNumber = Number(value);
        if (Number.isFinite(asNumber)) {
          return true;
        }

        const asDate = new Date(value);
        if (!Number.isNaN(asDate.getTime())) {
          return true;
        }
      }

      throw new Error("expiresAt must be a valid date string or unix timestamp.");
    }),
  body("originalTransactionId")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 255 })
    .withMessage("originalTransactionId is invalid."),
  strictSchema({
    body: ["platform", "productId", "purchaseToken", "expiresAt", "originalTransactionId"],
  }),
];

export const slotIdParamValidation = [
  param("slotId")
    .isInt({ min: 1 })
    .withMessage("slotId must be a positive integer."),
  strictSchema({ params: ["slotId"], body: [], query: [] }),
];

export const upsertWorkingHourValidation = [
  body("dayOfWeek")
    .isInt({ min: 0, max: 6 })
    .withMessage("dayOfWeek must be between 0 and 6."),
  body("startTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("startTime must be HH:mm."),
  body("endTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("endTime must be HH:mm."),
  body("slotDurationMin")
    .optional()
    .isInt({ min: 5, max: 360 })
    .withMessage("slotDurationMin must be between 5 and 360 minutes."),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean."),
  strictSchema({
    body: ["dayOfWeek", "startTime", "endTime", "slotDurationMin", "isActive"],
  }),
];

const timeZoneValidator = (value: unknown): boolean => {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const generateSlotsValidation = [
  body("fromDate")
    .isISO8601()
    .withMessage("fromDate must be a valid ISO date."),
  body("toDate")
    .isISO8601()
    .withMessage("toDate must be a valid ISO date."),
  body("timeZone")
    .optional({ values: "falsy" })
    .custom(timeZoneValidator)
    .withMessage("timeZone must be a valid IANA timezone."),
  strictSchema({ body: ["fromDate", "toDate", "timeZone"] }),
];

export const regenerateDayValidation = [
  param("date").matches(DATE_KEY_RE).withMessage("date must be YYYY-MM-DD."),
  body("startTime")
    .optional({ values: "falsy" })
    .matches(HHMM_RE)
    .withMessage("startTime must be HH:mm."),
  body("endTime")
    .optional({ values: "falsy" })
    .matches(HHMM_RE)
    .withMessage("endTime must be HH:mm."),
  body("slotDurationMin")
    .optional()
    .isInt({ min: 5, max: 360 })
    .withMessage("slotDurationMin must be between 5 and 360 minutes."),
  body("timeZone")
    .optional({ values: "falsy" })
    .custom(timeZoneValidator)
    .withMessage("timeZone must be a valid IANA timezone."),
  body().custom((value: any) => {
    const hasStart = typeof value?.startTime === "string" && value.startTime.trim().length > 0;
    const hasEnd = typeof value?.endTime === "string" && value.endTime.trim().length > 0;
    if (hasStart !== hasEnd) {
      throw new Error("Provide both startTime and endTime, or neither.");
    }
    return true;
  }),
  strictSchema({ params: ["date"], body: ["startTime", "endTime", "slotDurationMin", "timeZone"] }),
];

export const createOneOffSlotValidation = [
  body("date").matches(DATE_KEY_RE).withMessage("date must be YYYY-MM-DD."),
  body("startTime").matches(HHMM_RE).withMessage("startTime must be HH:mm."),
  body("endTime").matches(HHMM_RE).withMessage("endTime must be HH:mm."),
  body("note")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("note must be at most 500 characters."),
  body("timeZone")
    .optional({ values: "falsy" })
    .custom(timeZoneValidator)
    .withMessage("timeZone must be a valid IANA timezone."),
  strictSchema({ body: ["date", "startTime", "endTime", "note", "timeZone"] }),
];

export const blockDateValidation = [
  body("date").matches(DATE_KEY_RE).withMessage("date must be YYYY-MM-DD."),
  body("reason")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 255 })
    .withMessage("reason must be at most 255 characters."),
  body("timeZone")
    .optional({ values: "falsy" })
    .custom(timeZoneValidator)
    .withMessage("timeZone must be a valid IANA timezone."),
  strictSchema({ body: ["date", "reason", "timeZone"] }),
];

export const unblockDateValidation = [
  param("date").matches(DATE_KEY_RE).withMessage("date must be YYYY-MM-DD."),
  strictSchema({ params: ["date"], body: [], query: [] }),
];

export const blockedDatesQueryValidation = [
  query("from")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("from must be a valid ISO date."),
  query("to")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("to must be a valid ISO date."),
  query("timeZone")
    .optional({ values: "falsy" })
    .custom(timeZoneValidator)
    .withMessage("timeZone must be a valid IANA timezone."),
  strictSchema({ query: ["from", "to", "timeZone"] }),
];

export const trainerSlotsQueryValidation = [
  query("from")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("from must be a valid ISO date."),
  query("to")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("to must be a valid ISO date."),
  strictSchema({ query: ["from", "to"] }),
];

export const searchClientsQueryValidation = [
  query("q")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("q must be between 2 and 100 characters."),
  strictSchema({ query: ["q"] }),
];

export const resolveClientCodeValidation = [
  body("code")
    .trim()
    .matches(/^\d{6}$/)
    .withMessage("code must have exactly 6 digits."),
  strictSchema({ body: ["code"] }),
];

export const assignClientToSlotValidation = [
  param("slotId")
    .isInt({ min: 1 })
    .withMessage("slotId must be a positive integer."),
  body("clientId")
    .isInt({ min: 1 })
    .withMessage("clientId must be a positive integer."),
  body("note")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("note must be at most 500 characters."),
  strictSchema({
    params: ["slotId"],
    body: ["clientId", "note"],
  }),
];

export const assignSlotByCodeValidation = [
  param("slotId")
    .isInt({ min: 1 })
    .withMessage("slotId must be a positive integer."),
  body("code")
    .trim()
    .matches(/^\d{6}$/)
    .withMessage("code must have exactly 6 digits."),
  body("note")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("note must be at most 500 characters."),
  strictSchema({
    params: ["slotId"],
    body: ["code", "note"],
  }),
];

export const assignSlotByCodeIdValidation = [
  param("slotId")
    .isInt({ min: 1 })
    .withMessage("slotId must be a positive integer."),
  body("checkInCodeId")
    .isInt({ min: 1 })
    .withMessage("checkInCodeId must be a positive integer."),
  body("note")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("note must be at most 500 characters."),
  strictSchema({
    params: ["slotId"],
    body: ["checkInCodeId", "note"],
  }),
];

export const trainerCheckInValidation = [
  param("slotId")
    .isInt({ min: 1 })
    .withMessage("slotId must be a positive integer."),
  body("code")
    .trim()
    .matches(/^\d{6}$/)
    .withMessage("code must have exactly 6 digits."),
  strictSchema({
    params: ["slotId"],
    body: ["code"],
  }),
];

export const clientScheduleQueryValidation = [
  query("from")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("from must be a valid ISO date."),
  query("to")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("to must be a valid ISO date."),
  strictSchema({ query: ["from", "to"] }),
];

export const upsertClientPreferencesValidation = [
  body("preferredSpecializationIds")
    .optional()
    .isArray({ max: 50 })
    .withMessage("preferredSpecializationIds must be an array."),
  body("preferredSpecializationIds.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Each specialization id must be a positive integer."),
  body("goals")
    .optional()
    .isArray({ max: 20 })
    .withMessage("goals must be an array."),
  body("goals.*")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each goal must be between 1 and 50 characters."),
  body("fitnessLevel")
    .optional({ values: "null" })
    .isIn(["beginner", "intermediate", "expert"])
    .withMessage("fitnessLevel must be beginner, intermediate or expert."),
  body("budgetMin")
    .optional({ values: "null" })
    .isFloat({ min: 0, max: 999.99 })
    .withMessage("budgetMin must be between 0 and 999.99."),
  body("budgetMax")
    .optional({ values: "null" })
    .isFloat({ min: 0, max: 999.99 })
    .withMessage("budgetMax must be between 0 and 999.99."),
  body("preferredRateType")
    .optional()
    .isIn(["hourly", "session"])
    .withMessage("preferredRateType must be hourly or session."),
  body("maxDistanceKm")
    .optional({ values: "null" })
    .isFloat({ min: 0, max: 500 })
    .withMessage("maxDistanceKm must be between 0 and 500."),
  body("preferredGymId")
    .optional({ values: "null" })
    .isInt({ min: 1 })
    .withMessage("preferredGymId must be a positive integer."),
  strictSchema({
    body: [
      "preferredSpecializationIds",
      "goals",
      "fitnessLevel",
      "budgetMin",
      "budgetMax",
      "preferredRateType",
      "maxDistanceKm",
      "preferredGymId",
    ],
  }),
];

export const suggestTrainersValidation = [
  query("page")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer."),
  query("limit")
    .optional({ values: "falsy" })
    .isInt({ min: 1, max: 50 })
    .withMessage("limit must be between 1 and 50."),
  strictSchema({ query: ["page", "limit"] }),
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
