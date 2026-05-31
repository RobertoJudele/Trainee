import { hasEnv } from "./env";

export type UnknownFieldMode = "monitor" | "enforce";

const toPositiveInteger = (
  value: string | undefined,
  fallback: number,
  minimum: number = 1
): number => {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
};

const toUnknownFieldMode = (value: string | undefined): UnknownFieldMode => {
  if (typeof value !== "string") {
    return "monitor";
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "enforce" ? "enforce" : "monitor";
};

const parseTrustProxySetting = (): boolean | number | string => {
  const raw = process.env.TRUST_PROXY;
  if (typeof raw !== "string") {
    return true;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  const asNumber = Number.parseInt(normalized, 10);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return asNumber;
  }

  return raw;
};

export const securityConfig = {
  trustProxy: parseTrustProxySetting(),
  unknownFieldMode: toUnknownFieldMode(process.env.INPUT_UNKNOWN_FIELDS_MODE),
  rateLimit: {
    public: {
      windowMs: toPositiveInteger(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS, 60_000),
      max: toPositiveInteger(process.env.RATE_LIMIT_PUBLIC_MAX, 120),
    },
    auth: {
      windowMs: toPositiveInteger(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60_000),
      max: toPositiveInteger(process.env.RATE_LIMIT_AUTH_MAX, 25),
    },
    email: {
      windowMs: toPositiveInteger(process.env.RATE_LIMIT_EMAIL_WINDOW_MS, 15 * 60_000),
      max: toPositiveInteger(process.env.RATE_LIMIT_EMAIL_MAX, 15),
    },
    checkout: {
      windowMs: toPositiveInteger(process.env.RATE_LIMIT_CHECKOUT_WINDOW_MS, 60_000),
      max: toPositiveInteger(process.env.RATE_LIMIT_CHECKOUT_MAX, 30),
    },
    webhook: {
      windowMs: toPositiveInteger(process.env.RATE_LIMIT_WEBHOOK_WINDOW_MS, 60_000),
      max: toPositiveInteger(process.env.RATE_LIMIT_WEBHOOK_MAX, 600),
    },
  },
} as const;

export const isUnknownFieldEnforced = (): boolean =>
  securityConfig.unknownFieldMode === "enforce";

export const getMissingRequiredSecurityEnv = (): string[] => {
  const required = ["JWT_SECRET", "CHECKIN_CODE_SECRET"];
  return required.filter((name) => !hasEnv(name));
};
