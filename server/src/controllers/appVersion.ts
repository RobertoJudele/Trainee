import { Request, Response } from "express";
import { AppMinVersion } from "../models/appMinVersion";
import { AppReleaseNote } from "../models/appReleaseNote";
import { isUpdateRequired } from "../utils/versionCompare";
import { sendSuccess } from "../utils/response";

// Public endpoint — always 200 with a safe fail-open payload so a bad request
// or missing config never bricks the client.
const NO_UPDATE = {
  updateRequired: false,
  message: "",
  storeUrl: "",
  releaseNotes: null,
};

/**
 * Published notes for an exact version, or null. A version with no row simply
 * shows nothing, so skipping a release needs no special handling — and a draft
 * row stays invisible until it is published.
 */
const findReleaseNotes = async (version: string) => {
  const trimmed = version.trim();
  if (!trimmed) return null;

  const note = await AppReleaseNote.findOne({
    where: { version: trimmed, isPublished: true },
  });

  return note ? { version: note.version, title: note.title, body: note.body } : null;
};

export const checkVersion = async (req: Request, res: Response) => {
  try {
    const platform = String(req.query.platform || "").toLowerCase();
    const version = String(req.query.version || "");

    if (platform !== "ios" && platform !== "android") {
      return sendSuccess(res, 200, "Version check", NO_UPDATE);
    }

    const config = await AppMinVersion.findOne({ where: { platform } });
    if (!config) {
      return sendSuccess(res, 200, "Version check", NO_UPDATE);
    }

    const updateRequired = isUpdateRequired(version, config.minVersion);

    // Notes for the version the caller is actually running. Not sent when an
    // update is required — the client shows the blocking wall then, and a
    // "what's new" sheet behind it would be noise. Rides this request rather
    // than adding a second one at launch.
    const releaseNotes = updateRequired ? null : await findReleaseNotes(version);

    return sendSuccess(res, 200, "Version check", {
      updateRequired,
      message: updateRequired ? config.message : "",
      storeUrl: config.storeUrl,
      releaseNotes,
    });
  } catch (error) {
    console.error("Error checking app version", error);
    // Fail open: never block the client because of a server error.
    return sendSuccess(res, 200, "Version check", NO_UPDATE);
  }
};
