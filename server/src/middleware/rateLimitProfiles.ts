import { securityConfig } from "../config/security";
import { createRateLimitMiddleware } from "./rateLimit";

const extractEmailIdentity = (candidate: unknown): string | null => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const email = (candidate as { email?: unknown }).email;
  if (typeof email !== "string") {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

export const authRateLimit = createRateLimitMiddleware({
  keyPrefix: "auth",
  message: "Too many authentication attempts. Please try again later.",
  windowMs: securityConfig.rateLimit.auth.windowMs,
  max: securityConfig.rateLimit.auth.max,
  keyStrategy: "ip",
  identityExtractor: (req) => extractEmailIdentity(req.body),
});

export const emailPublicRateLimit = createRateLimitMiddleware({
  keyPrefix: "email",
  message: "Too many email verification requests. Please try again later.",
  windowMs: securityConfig.rateLimit.email.windowMs,
  max: securityConfig.rateLimit.email.max,
  keyStrategy: "ip",
  identityExtractor: (req) =>
    extractEmailIdentity(req.body) ?? extractEmailIdentity(req.query),
});

export const publicReadRateLimit = createRateLimitMiddleware({
  keyPrefix: "public",
  message: "Too many requests. Please slow down and try again.",
  windowMs: securityConfig.rateLimit.public.windowMs,
  max: securityConfig.rateLimit.public.max,
  keyStrategy: "userOrIp",
});

export const checkoutRateLimit = createRateLimitMiddleware({
  keyPrefix: "checkout",
  message: "Too many billing requests. Please try again in a moment.",
  windowMs: securityConfig.rateLimit.checkout.windowMs,
  max: securityConfig.rateLimit.checkout.max,
  keyStrategy: "ipAndUser",
  identityExtractor: (req) => extractEmailIdentity(req.body),
});

export const webhookRateLimit = createRateLimitMiddleware({
  keyPrefix: "webhook",
  message: "Too many webhook requests. Please retry later.",
  windowMs: securityConfig.rateLimit.webhook.windowMs,
  max: securityConfig.rateLimit.webhook.max,
  keyStrategy: "ip",
});
