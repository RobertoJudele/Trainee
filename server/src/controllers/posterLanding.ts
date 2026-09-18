import { Request, Response } from "express";
import sequelize from "../db";
import { PosterCode } from "../models/posterCode";
import { Gym } from "../models/gym";
import { billingService } from "../services/billing/container";
import { renderPosterLanding } from "../services/posterLandingPage";
import { renderNotFound, PageOptions } from "../services/publicProfilePage";
import {
  detectStorePlatform,
  shouldCountPosterHit,
} from "../services/posterScanCounting";
import { appleStoreUrl, playStoreUrl } from "../utils/storeLinks";
import { publicWebBaseUrl } from "../utils/publicUrl";

/**
 * The QR poster routes: public, unauthenticated HTML, mounted beside /t/:slug
 * for the same reason — browsers fetch them directly and they must keep working
 * if the JSON API surface changes.
 */

const pageOptions = (): PageOptions => ({
  baseUrl: publicWebBaseUrl(),
  appleStoreUrl: appleStoreUrl(),
  playStoreUrl: playStoreUrl(),
});

const findActivePoster = async (code: string): Promise<PosterCode | null> => {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) return null;

  return PosterCode.findOne({
    where: { code: trimmed, isActive: true },
    include: [{ model: Gym, attributes: ["name"], required: false }],
  });
};

/**
 * One atomic statement, so two people scanning at the same moment cannot read
 * the same value and write it back twice.
 */
const recordScan = async (posterId: number): Promise<void> => {
  await sequelize.query(
    "UPDATE poster_codes SET scan_count = scan_count + 1, last_scanned_at = NOW(), updated_at = NOW() WHERE id = :id",
    { replacements: { id: posterId } }
  );
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

export const getPosterLandingPage = async (
  req: Request,
  res: Response
): Promise<void> => {
  // Never cached: this response increments a counter, and a proxy serving it
  // from cache is a scan that never reaches the database.
  res.set("Cache-Control", "no-store");

  try {
    const poster = await findActivePoster(String(req.params.code ?? ""));

    if (!poster) {
      res.status(404).type("html").send(renderNotFound(pageOptions()));
      return;
    }

    if (shouldCountPosterHit(req)) {
      await recordScan(poster.id);
    }

    const gymName = poster.gym?.name?.trim() ?? poster.label;

    res.type("html").send(
      renderPosterLanding({
        gymName: gymName || null,
        gymLogoUrl: poster.gymLogoUrl ?? null,
        startUrl: `/p/${encodeURIComponent(poster.code)}/start`,
        // Same source as the in-app founding-offer banner, so the poster page
        // and the app can never advertise different terms.
        offer: billingService.getFoundingGrantOffer(),
      })
    );
  } catch (error) {
    console.error("[POSTER] landing page failed:", error);
    res.status(500).type("html").send(renderNotFound(pageOptions()));
  }
};

export const startFromPoster = async (req: Request, res: Response): Promise<void> => {
  const platform = detectStorePlatform(
    typeof req.headers["user-agent"] === "string"
      ? req.headers["user-agent"]
      : undefined
  );
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
