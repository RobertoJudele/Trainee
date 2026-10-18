import { Request, Response } from "express";
import sequelize from "../db";
import { PosterCode } from "../models/posterCode";
import { Gym } from "../models/gym";
import { Trainer } from "../models/trainer";
import { TrainerGym } from "../models/trainerGym";
import { PosterScanEvent } from "../models/posterScanEvent";
import { renderPosterLanding } from "../services/posterLandingPage";
import {
  detectStorePlatform,
  shouldCountPosterHit,
} from "../services/posterScanCounting";
import { appleStoreUrl, playStoreUrl } from "../utils/storeLinks";

/**
 * The QR poster routes: public, unauthenticated HTML, mounted beside /t/:slug
 * for the same reason — browsers fetch them directly and they must keep working
 * if the JSON API surface changes.
 */

const findActivePoster = async (code: string): Promise<PosterCode | null> => {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) return null;

  return PosterCode.findOne({
    where: { code: trimmed, isActive: true },
    include: [{ model: Gym, attributes: ["id", "name"], required: false }],
  });
};

/**
 * One atomic statement, so two people scanning at the same moment cannot read
 * the same value and write it back twice.
 */
const recordScan = async (poster: PosterCode, userAgent: string | undefined): Promise<void> => {
  const platform = detectStorePlatform(userAgent);
  await sequelize.query(
    "UPDATE poster_codes SET scan_count = scan_count + 1, last_scanned_at = NOW(), updated_at = NOW() WHERE id = :id",
    { replacements: { id: poster.id } }
  );
  await PosterScanEvent.create({
    posterCodeId: poster.id,
    gymId: poster.gymId ?? null,
    device: platform === "unknown" ? "other" : platform,
  });
};

const recordStoreClick = async (
  posterId: number,
  platform: "ios" | "android"
): Promise<void> => {
  // Column comes from a literal ternary, never from the request.
  const column = platform === "ios" ? "apple_click_count" : "play_click_count";
  await sequelize.query(
    `UPDATE poster_codes SET ${column} = ${column} + 1, updated_at = NOW() WHERE id = :id`,
    { replacements: { id: posterId } }
  );
};

/**
 * Trainers a member opening this gym's pin would see: the same Trainer
 * "active" scope and required join as GET /gyms/:gymId.
 */
const countVisibleTrainers = (gymId: number): Promise<number> =>
  TrainerGym.count({
    where: { gymId },
    include: [{ model: Trainer.scope("active"), as: "trainer", attributes: [], required: true }],
  });

/** wa.me wants digits only: no "+", spaces or dashes. */
const whatsappNumber = (): string | null => {
  const digits = (process.env.SALVIO_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  return digits || null;
};

const userAgentOf = (req: Request): string | undefined =>
  typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;

/** Rendered without touching the database, for when the database is the problem. */
/**
 * The store button goes through /start even for an unknown code: that route
 * redirects by platform and simply skips the count.
 */
const startUrlFor = (code: string): string => `/p/${encodeURIComponent(code)}/start`;

const errorPage = (code: string): string =>
  renderPosterLanding({
    gymName: null,
    trainerCount: 0,
    whatsappNumber: whatsappNumber(),
    startUrl: startUrlFor(code),
  });

const renderFor = async (poster: PosterCode | null, code: string): Promise<string> => {
  const gym = poster?.gym ?? null;

  return renderPosterLanding({
    // Only a linked gym's name is shown: labels carry admin suffixes like "v1".
    gymName: gym?.name ?? null,
    trainerCount: gym ? await countVisibleTrainers(gym.id) : 0,
    whatsappNumber: whatsappNumber(),
    startUrl: startUrlFor(poster?.code ?? code),
  });
};

export const getPosterLandingPage = async (
  req: Request,
  res: Response
): Promise<void> => {
  // Never cached: this response increments a counter, and a proxy serving it
  // from cache is a scan that never reaches the database.
  res.set("Cache-Control", "no-store");
  const code = String(req.params.code ?? "");

  try {
    const poster = await findActivePoster(code);

    if (!poster) {
      // Unknown or retired code: still 404, but someone standing in a gym gets
      // the gym-neutral page rather than an error.
      res.status(404).type("html").send(await renderFor(null, code));
      return;
    }

    if (shouldCountPosterHit(req)) {
      await recordScan(poster, userAgentOf(req));
    }

    res.type("html").send(await renderFor(poster, code));
  } catch (error) {
    console.error("[POSTER] landing page failed:", error);
    res.status(500).type("html").send(errorPage(code));
  }
};

/** The page's "Descarcă aplicația" button: a counted redirect to the right store. */
export const startFromPoster = async (req: Request, res: Response): Promise<void> => {
  const platform = detectStorePlatform(userAgentOf(req));
  const destination = platform === "ios" ? appleStoreUrl() : playStoreUrl();

  try {
    const poster = await findActivePoster(String(req.params.code ?? ""));

    if (poster && platform !== "unknown" && shouldCountPosterHit(req)) {
      await recordStoreClick(poster.id, platform);
    }
  } catch (error) {
    // A counter failure must never strand someone between a poster and the app.
    console.error("[POSTER] store click failed:", error);
  }

  res.set("Cache-Control", "no-store");
  res.redirect(302, destination);
};
