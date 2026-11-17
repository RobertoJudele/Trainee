import { Request } from "express";
import sequelize from "../db";
import { QueryTypes } from "sequelize";
import {
  detectStorePlatform,
  getRequestIp,
  shouldCountPosterHit,
} from "./posterScanCounting";
import { LANDING_POSITIONS, LandingPosition } from "./trainerLandingPage";
import type { LandingEventDevice } from "../models/landingEvent";

/**
 * Which landing-page hits count, and the numbers behind /antrenori/stats.
 *
 * Crawlers, HEAD requests and floods are dropped by the same rules as the gym
 * posters (shouldCountPosterHit). On top of that, the same address repeating
 * the same action within REPEAT_WINDOW_MS counts once, so a trainer reloading
 * the page or tapping the store button twice is one visit and one click.
 */

const REPEAT_WINDOW_MS = 30 * 60_000;
/** Bounds memory; clearing only re-admits a repeat, it never loses a count. */
const MAX_TRACKED_KEYS = 20_000;

const lastSeen = new Map<string, number>();

const isRepeat = (key: string): boolean => {
  const now = Date.now();
  if (lastSeen.size > MAX_TRACKED_KEYS) lastSeen.clear();
  const previous = lastSeen.get(key);
  lastSeen.set(key, now);
  return previous !== undefined && now - previous < REPEAT_WINDOW_MS;
};

/** `action` is "visit" or "click:<target>": each is de-duplicated on its own. */
export const shouldCountLandingHit = (req: Request, action: string): boolean => {
  if (!shouldCountPosterHit(req)) return false;
  return !isRepeat(`${getRequestIp(req)}|${action}`);
};

/** Test seam — the repeat map is module-level state. */
export const resetLandingRepeats = (): void => {
  lastSeen.clear();
};

/** ig, tt, fb, ... — anything else (or nothing) is stored as null, "direct". */
export const normalizeSource = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{1,24}$/.test(value) ? value : null;
};

export const normalizePosition = (raw: unknown): LandingPosition | null =>
  typeof raw === "string" && (LANDING_POSITIONS as readonly string[]).includes(raw)
    ? (raw as LandingPosition)
    : null;

export const deviceOf = (userAgent: string | undefined): LandingEventDevice => {
  const platform = detectStorePlatform(userAgent);
  return platform === "unknown" ? "other" : platform;
};

// ---------- stats ----------

export interface LandingCountRow {
  kind: "visit" | "click";
  target: "ios" | "android" | "instagram" | null;
  source: string;
  device: LandingEventDevice;
  position: string | null;
  n: number;
}

export interface LandingDayRow {
  day: string;
  visits: number;
  storeClicks: number;
}

export const landingCounts = (days: number): Promise<LandingCountRow[]> =>
  sequelize.query<LandingCountRow>(
    `SELECT kind, target, COALESCE(source, 'direct') AS source, device, position,
            COUNT(*)::int AS n
       FROM landing_events
      WHERE created_at >= NOW() - make_interval(days => :days)
      GROUP BY kind, target, COALESCE(source, 'direct'), device, position`,
    { replacements: { days }, type: QueryTypes.SELECT }
  );

/** Calendar days in Bucharest time, newest first. */
export const landingDaily = (days: number): Promise<LandingDayRow[]> =>
  sequelize.query<LandingDayRow>(
    `SELECT to_char(created_at AT TIME ZONE 'Europe/Bucharest', 'YYYY-MM-DD') AS day,
            COUNT(*) FILTER (WHERE kind = 'visit')::int AS "visits",
            COUNT(*) FILTER (WHERE kind = 'click' AND target IN ('ios', 'android'))::int AS "storeClicks"
       FROM landing_events
      WHERE created_at >= NOW() - make_interval(days => :days)
      GROUP BY 1
      ORDER BY 1 DESC`,
    { replacements: { days }, type: QueryTypes.SELECT }
  );
