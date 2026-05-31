import { Request } from "express";
import { Op } from "sequelize";
import { Trainer } from "../models/trainer";
import { ProfileViewEvent, ProfileViewSourceType } from "../models/profileViewEvent";

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_EVENTS = 5;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const rateLimitBuckets = new Map<string, number[]>();

const getRequestIp = (req: Request): string => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
};

const getSourceType = (referrerUrl?: string | null): ProfileViewSourceType => {
  if (!referrerUrl) {
    return "direct";
  }

  const normalized = referrerUrl.toLowerCase();
  if (normalized.includes("/search")) {
    return "search";
  }

  if (normalized.includes("/map")) {
    return "map";
  }

  return "other";
};

const isRateLimited = (identifier: string): boolean => {
  const now = Date.now();
  const events = rateLimitBuckets.get(identifier) ?? [];
  const recentEvents = events.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  recentEvents.push(now);
  rateLimitBuckets.set(identifier, recentEvents);

  return recentEvents.length > RATE_LIMIT_MAX_EVENTS;
};

const getDedupWhereClause = (trainerId: number, viewerUserId: number | null, viewerIpAddress: string) => {
  const dedupeWindowStart = new Date(Date.now() - DEDUPE_WINDOW_MS);

  return {
    trainerId,
    createdAt: {
      [Op.gte]: dedupeWindowStart,
    },
    [viewerUserId !== null ? "viewerUserId" : "viewerIpAddress"]:
      viewerUserId !== null ? viewerUserId : viewerIpAddress,
  } as const;
};

export const trackTrainerProfileView = async ({
  trainer,
  req,
}: {
  trainer: Trainer;
  req: Request & { user?: { id?: number } };
}): Promise<{ counted: boolean; reason?: "rate_limited" | "deduped" }> => {
  const viewerUserId = typeof req.user?.id === "number" ? req.user.id : null;
  const viewerIpAddress = getRequestIp(req);
  const rateLimitKey = viewerUserId ? `user:${viewerUserId}` : `ip:${viewerIpAddress}`;

  if (isRateLimited(rateLimitKey)) {
    return { counted: false, reason: "rate_limited" };
  }

  const recentView = await ProfileViewEvent.findOne({
    where: getDedupWhereClause(trainer.id, viewerUserId, viewerIpAddress),
    order: [["createdAt", "DESC"]],
  });

  if (recentView) {
    return { counted: false, reason: "deduped" };
  }

  const referrerUrl = typeof req.headers.referer === "string" ? req.headers.referer : null;
  const sourceType = getSourceType(referrerUrl);

  await ProfileViewEvent.create({
    trainerId: trainer.id,
    viewerUserId,
    viewerIpAddress,
    viewerUserAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    referrerUrl,
    sourceType,
    viewedAt: new Date(),
  });

  await trainer.incrementViews();

  return { counted: true };
};
