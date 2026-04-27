import { Request, Response, NextFunction, RequestHandler } from "express";
import { sendError } from "../utils/response";

type KeyStrategy = "ip" | "userOrIp" | "ipAndUser";

interface StoreIncrementResult {
  count: number;
  resetAtMs: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number, nowMs: number): Promise<StoreIncrementResult>;
}

interface InMemoryEntry {
  count: number;
  resetAtMs: number;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, InMemoryEntry>();

  async increment(
    key: string,
    windowMs: number,
    nowMs: number
  ): Promise<StoreIncrementResult> {
    const existing = this.entries.get(key);
    if (!existing || existing.resetAtMs <= nowMs) {
      const created: InMemoryEntry = {
        count: 1,
        resetAtMs: nowMs + windowMs,
      };
      this.entries.set(key, created);
      return created;
    }

    existing.count += 1;
    this.entries.set(key, existing);
    return existing;
  }
}

export interface RateLimitMiddlewareOptions {
  keyPrefix: string;
  message: string;
  windowMs: number;
  max: number;
  keyStrategy?: KeyStrategy;
  identityExtractor?: (req: Request) => string | null;
}

const defaultStore = new InMemoryRateLimitStore();

const getClientIp = (req: Request): string => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].split(",")[0].trim();
  }

  return req.ip || req.socket.remoteAddress || "unknown";
};

const normalizeKeyPart = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const buildRateKeys = (
  req: Request,
  options: RateLimitMiddlewareOptions
): string[] => {
  const keyStrategy = options.keyStrategy ?? "userOrIp";
  const keys: string[] = [];
  const ipKey = `${options.keyPrefix}:ip:${normalizeKeyPart(getClientIp(req))}`;
  const userId =
    req.user && typeof req.user.id === "number" ? String(req.user.id) : null;

  if (keyStrategy === "ip") {
    keys.push(ipKey);
  }

  if (keyStrategy === "userOrIp") {
    if (userId) {
      keys.push(`${options.keyPrefix}:user:${userId}`);
    } else {
      keys.push(ipKey);
    }
  }

  if (keyStrategy === "ipAndUser") {
    keys.push(ipKey);
    if (userId) {
      keys.push(`${options.keyPrefix}:user:${userId}`);
    }
  }

  if (typeof options.identityExtractor === "function") {
    const identity = options.identityExtractor(req);
    if (identity) {
      keys.push(`${options.keyPrefix}:identity:${normalizeKeyPart(identity)}`);
    }
  }

  return Array.from(new Set(keys));
};

export const createRateLimitMiddleware = (
  options: RateLimitMiddlewareOptions,
  store: RateLimitStore = defaultStore
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const nowMs = Date.now();
    const keys = buildRateKeys(req, options);

    let exceeded = false;
    let retryAfterSeconds = 1;
    let highestCount = 0;

    for (const key of keys) {
      const result = await store.increment(key, options.windowMs, nowMs);
      highestCount = Math.max(highestCount, result.count);

      if (result.count > options.max) {
        exceeded = true;
        retryAfterSeconds = Math.max(
          retryAfterSeconds,
          Math.ceil((result.resetAtMs - nowMs) / 1000)
        );
      }
    }

    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, options.max - highestCount))
    );

    if (exceeded) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      sendError(res, 429, options.message);
      return;
    }

    next();
  };
};
