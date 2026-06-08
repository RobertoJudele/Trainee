// Timezone-aware scheduling helpers.
//
// Contract: a trainer's working-hours are wall-clock times in their local
// timezone. Slots are persisted as absolute UTC instants. All conversions
// between a calendar day + wall-clock minutes and a UTC instant go through
// this module — never use Date#setHours ad hoc for slot math.
//
// Implemented with Intl.DateTimeFormat offset math so no extra dependency
// (luxon / date-fns-tz) is required.
import { getOptionalEnv } from "../config/env";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns a valid IANA timezone: the provided value if parseable, else the
 * DEFAULT_TIMEZONE env, else "UTC".
 */
export const resolveTimeZone = (input?: string | null): string => {
  const candidate = (input && input.trim()) || getOptionalEnv("DEFAULT_TIMEZONE") || "UTC";
  return isValidTimeZone(candidate) ? candidate : "UTC";
};

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const parseTimeToMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

// Offset (in ms) between the given timezone and UTC at a specific instant:
// tzWallClock - utcInstant. Positive east of UTC.
const tzOffsetMs = (utcMs: number, timeZone: string): number => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - utcMs;
};

/**
 * Converts a wall-clock time (calendar dateKey + minutes from midnight) in the
 * given timezone to the corresponding absolute UTC Date.
 */
export const zonedWallClockToUtc = (
  dateKey: string,
  minutes: number,
  timeZone: string
): Date => {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  // Treat the wall clock as if it were UTC, then subtract the zone offset.
  const utcGuess = Date.UTC(y, mo - 1, d, hour, minute, 0, 0);
  const offset = tzOffsetMs(utcGuess, timeZone);
  let instant = utcGuess - offset;

  // Refine once for DST transition edges where the offset differs at the
  // computed instant.
  const refinedOffset = tzOffsetMs(instant, timeZone);
  if (refinedOffset !== offset) {
    instant = utcGuess - refinedOffset;
  }

  return new Date(instant);
};

/**
 * Inclusive UTC bounds [start, end] for a calendar day in the given timezone.
 */
export const zonedDayBoundsUtc = (
  dateKey: string,
  timeZone: string
): { start: Date; end: Date } => {
  const start = zonedWallClockToUtc(dateKey, 0, timeZone);
  const nextDay = addDaysToKey(dateKey, 1);
  const end = new Date(zonedWallClockToUtc(nextDay, 0, timeZone).getTime() - 1);
  return { start, end };
};

/** The calendar weekday (0=Sun..6=Sat) for a YYYY-MM-DD key. */
export const dateKeyWeekday = (dateKey: string): number => {
  const [y, mo, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
};

/** Add (or subtract) whole days to a YYYY-MM-DD key, returning a YYYY-MM-DD key. */
export const addDaysToKey = (dateKey: string, days: number): string => {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, mo - 1, d));
  next.setUTCDate(next.getUTCDate() + days);
  return toKeyFromUtcParts(next);
};

const toKeyFromUtcParts = (date: Date): string => {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
};

/** Whole-day difference between two YYYY-MM-DD keys (toKey - fromKey). */
export const dayDiff = (fromKey: string, toKey: string): number => {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
};

/**
 * Extracts a calendar dateKey from an input that may be a YYYY-MM-DD string or
 * a full ISO timestamp. For timestamps, the day is resolved in the given tz.
 */
export const extractDateKey = (input: string, timeZone: string): string | null => {
  if (DATE_KEY_RE.test(input)) {
    return input;
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return utcInstantToDateKey(date, timeZone);
};

/** The calendar dateKey (in the given tz) for a UTC instant. */
export const utcInstantToDateKey = (date: Date, timeZone: string): string => {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA formats as YYYY-MM-DD.
  return dtf.format(date);
};

export const isDateKey = (value: string): boolean => DATE_KEY_RE.test(value);
