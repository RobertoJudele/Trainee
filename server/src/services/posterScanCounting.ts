import { Request } from "express";

/**
 * Which poster hits count. Each rule here exists because the hit it excludes
 * would otherwise silently inflate every number on the admin list.
 */

/** Bots that fetch a URL the moment it is pasted into a chat. */
const CRAWLER_PATTERN =
  /(facebookexternalhit|WhatsApp|Twitterbot|TelegramBot|Discordbot|Slackbot|bingbot|Googlebot|LinkedInBot|Applebot)/i;

const FLOOD_WINDOW_MS = 60_000;
const FLOOD_MAX_HITS = 120;
/** Bounds memory if a scripted flood cycles through many source addresses. */
const MAX_TRACKED_IPS = 5_000;

const floodBuckets = new Map<string, number[]>();

const getRequestIp = (req: Request): string => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].split(",")[0].trim();
  }

  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
};

export const isCrawlerUserAgent = (userAgent: string | undefined): boolean =>
  typeof userAgent === "string" && CRAWLER_PATTERN.test(userAgent);

export const detectStorePlatform = (
  userAgent: string | undefined
): "ios" | "android" | "unknown" => {
  if (typeof userAgent !== "string") return "unknown";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "unknown";
};

/**
 * Deliberately loose, and deliberately not `publicReadRateLimit`: a gym NATs
 * every member behind one IP, so a normal limiter would refuse real scanners
 * and undercount exactly the posters that are working best. Over the threshold
 * the page is still served — only the increment is skipped.
 */
const isFloodLimited = (ip: string): boolean => {
  const now = Date.now();

  if (floodBuckets.size > MAX_TRACKED_IPS) {
    floodBuckets.clear();
  }

  const recent = (floodBuckets.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < FLOOD_WINDOW_MS
  );
  recent.push(now);
  floodBuckets.set(ip, recent);

  return recent.length > FLOOD_MAX_HITS;
};

export const shouldCountPosterHit = (req: Request): boolean => {
  // Express matches GET handlers for HEAD as well.
  if (req.method === "HEAD") return false;

  const userAgent =
    typeof req.headers["user-agent"] === "string"
      ? req.headers["user-agent"]
      : undefined;

  if (isCrawlerUserAgent(userAgent)) return false;

  return !isFloodLimited(getRequestIp(req));
};

/** Test seam — the buckets are module-level state. */
export const resetPosterFloodBuckets = (): void => {
  floodBuckets.clear();
};
