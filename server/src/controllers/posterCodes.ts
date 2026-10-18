import { Request, Response } from "express";
import { UniqueConstraintError } from "sequelize";
import { PosterCode } from "../models/posterCode";
import { generatePosterCode } from "../utils/posterCode";
import { publicWebBaseUrl } from "../utils/publicUrl";
import { sendError, sendSuccess } from "../utils/response";

/** Admin-only management of the printed poster codes. */

/**
 * The URL that goes into the QR generator. Built here rather than in the client
 * so moving PUBLIC_WEB_URL moves every future poster without a code change.
 *
 * Null until a consumer domain exists (see `trainerPublicUrl` in
 * `utils/publicUrl.ts`): a relative URL baked into a printed QR code is
 * unrecoverable once posters ship, so a missing base URL must surface as
 * "no URL yet" rather than as a fabricated relative path.
 */
const posterUrl = (code: string): string | null => {
  const base = publicWebBaseUrl();
  return base ? `${base}/p/${code}` : null;
};

interface SerializedPosterCode {
  id: number;
  code: string;
  label: string;
  gymId: number | null;
  gymLogoUrl: string | null;
  scanCount: number;
  appleClickCount: number;
  playClickCount: number;
  lastScannedAt: Date | null;
  isActive: boolean;
  url: string | null;
}

const serialize = (poster: PosterCode): SerializedPosterCode => ({
  id: poster.id,
  code: poster.code,
  label: poster.label,
  gymId: poster.gymId ?? null,
  gymLogoUrl: poster.gymLogoUrl ?? null,
  scanCount: poster.scanCount,
  appleClickCount: poster.appleClickCount,
  playClickCount: poster.playClickCount,
  lastScannedAt: poster.lastScannedAt ?? null,
  isActive: poster.isActive,
  url: posterUrl(poster.code),
});

export const createPosterCode = async (req: Request, res: Response) => {
  const label = String(req.body.label).trim();
  const requestedCode =
    typeof req.body.code === "string" ? req.body.code.trim().toLowerCase() : null;
  const gymId = req.body.gymId != null ? Number(req.body.gymId) : null;
  const gymLogoUrl =
    typeof req.body.gymLogoUrl === "string" ? req.body.gymLogoUrl.trim() : null;

  // A generated code can collide; retry a couple of times before giving up. A
  // code the admin chose is theirs to fix, so it is never retried.
  const attempts = requestedCode ? 1 : 3;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = requestedCode ?? generatePosterCode();

    try {
      const poster = await PosterCode.create({ code, label, gymId, gymLogoUrl });
      return sendSuccess(res, 201, "Poster code created", serialize(poster));
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        if (requestedCode) {
          return sendError(res, 409, "That code is already in use.");
        }
        continue;
      }

      console.error("[POSTER] create failed:", error);
      return sendError(res, 500, "Could not create the poster code.");
    }
  }

  return sendError(res, 500, "Could not allocate a unique poster code.");
};

export const listPosterCodes = async (_req: Request, res: Response) => {
  try {
    const posters = await PosterCode.findAll({
      order: [
        ["scanCount", "DESC"],
        ["id", "DESC"],
      ],
    });

    return sendSuccess(res, 200, "Poster codes retrieved", posters.map(serialize));
  } catch (error) {
    console.error("[POSTER] list failed:", error);
    return sendError(res, 500, "Could not list the poster codes.");
  }
};

export const updatePosterCode = async (req: Request, res: Response) => {
  try {
    const poster = await PosterCode.findByPk(Number(req.params.id));

    if (!poster) {
      return sendError(res, 404, "Poster code not found.");
    }

    if (typeof req.body.label === "string") {
      poster.label = req.body.label.trim();
    }
    if (typeof req.body.isActive === "boolean") {
      poster.isActive = req.body.isActive;
    }
    if (req.body.gymLogoUrl !== undefined) {
      poster.gymLogoUrl =
        typeof req.body.gymLogoUrl === "string" ? req.body.gymLogoUrl.trim() : null;
    }

    await poster.save();

    return sendSuccess(res, 200, "Poster code updated", serialize(poster));
  } catch (error) {
    console.error("[POSTER] update failed:", error);
    return sendError(res, 500, "Could not update the poster code.");
  }
};
