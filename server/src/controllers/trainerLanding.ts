import path from "path";
import { timingSafeEqual } from "crypto";
import { Request, Response } from "express";
import { LandingEvent, LandingEventTarget } from "../models/landingEvent";
import {
  LANDING_IMAGES,
  LANDING_TARGETS,
  SALVIO_INSTAGRAM_URL,
  renderTrainerLanding,
} from "../services/trainerLandingPage";
import {
  deviceOf,
  landingCounts,
  landingDaily,
  normalizePosition,
  normalizeSource,
  shouldCountLandingHit,
} from "../services/landingCounting";
import { renderLandingStats, summarize } from "../services/landingStatsPage";
import { detectStorePlatform } from "../services/posterScanCounting";
import { appleStoreUrl, playStoreUrl } from "../utils/storeLinks";
import { publicWebBaseUrl } from "../utils/publicUrl";

/**
 * The trainer landing page and its counted links: public, unauthenticated
 * HTML like /t/:slug and /p/:code. nginx serves it at the bare public host.
 */

/** server/assets/landing — two levels up from both src/controllers and dist/controllers. */
const ASSET_DIR = path.resolve(__dirname, "../../assets/landing");

const userAgentOf = (req: Request): string | undefined =>
  typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;

/** A failed insert must never cost the visitor the page or the redirect. */
const record = async (fields: {
  kind: "visit" | "click";
  target?: LandingEventTarget;
  position?: string | null;
  source: string | null;
  req: Request;
}): Promise<void> => {
  try {
    await LandingEvent.create({
      kind: fields.kind,
      target: fields.target ?? null,
      position: fields.position ?? null,
      source: fields.source,
      device: deviceOf(userAgentOf(fields.req)),
    });
  } catch (error) {
    console.error("[LANDING] could not record event:", error);
  }
};

export const getTrainerLandingPage = async (req: Request, res: Response): Promise<void> => {
  // Never cached: a cached response is a visit that never reaches the counter.
  res.set("Cache-Control", "no-store");
  const source = normalizeSource(req.query.src);

  if (shouldCountLandingHit(req, "visit")) {
    await record({ kind: "visit", source, req });
  }

  res.type("html").send(
    renderTrainerLanding({
      platform: detectStorePlatform(userAgentOf(req)),
      source,
      publicBaseUrl: publicWebBaseUrl(),
    })
  );
};

const destinationFor = (target: LandingEventTarget): string => {
  if (target === "ios") return appleStoreUrl();
  if (target === "android") return playStoreUrl();
  return SALVIO_INSTAGRAM_URL;
};

/** Every outbound link on the page: count, then redirect. */
export const goFromTrainerLanding = async (req: Request, res: Response): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const target = String(req.params.target ?? "");

  if (!(LANDING_TARGETS as readonly string[]).includes(target)) {
    res.status(404).type("text").send("Not found");
    return;
  }
  const clicked = target as LandingEventTarget;

  if (shouldCountLandingHit(req, `click:${clicked}`)) {
    await record({
      kind: "click",
      target: clicked,
      position: normalizePosition(req.query.from),
      source: normalizeSource(req.query.src),
      req,
    });
  }

  res.redirect(302, destinationFor(clicked));
};

/** The page's screenshots. Only the listed names are served — no path tricks. */
export const getTrainerLandingAsset = (req: Request, res: Response): void => {
  const file = String(req.params.file ?? "");

  if (!LANDING_IMAGES.includes(file)) {
    res.status(404).type("text").send("Not found");
    return;
  }

  res.sendFile(path.join(ASSET_DIR, file), { maxAge: "7d" }, (error) => {
    if (error && !res.headersSent) {
      console.error("[LANDING] asset missing:", file, error.message);
      res.status(404).type("text").send("Not found");
    }
  });
};

const keyMatches = (given: unknown, expected: string): boolean => {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * The numbers, for whoever holds LANDING_STATS_KEY. Without the variable set,
 * or with the wrong key, it is indistinguishable from a missing page.
 */
export const getTrainerLandingStats = async (req: Request, res: Response): Promise<void> => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  const expected = (process.env.LANDING_STATS_KEY ?? "").trim();

  if (!expected || !keyMatches(req.query.key, expected)) {
    res.status(404).type("text").send("Not found");
    return;
  }

  try {
    const [week, month, daily] = await Promise.all([
      landingCounts(7),
      landingCounts(30),
      landingDaily(14),
    ]);
    res.type("html").send(
      renderLandingStats({ week: summarize(week), month: summarize(month), daily })
    );
  } catch (error) {
    console.error("[LANDING] stats failed:", error);
    res.status(500).type("text").send("Statisticile nu au putut fi încărcate.");
  }
};
