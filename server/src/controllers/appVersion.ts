import { Request, Response } from "express";
import { AppMinVersion } from "../models/appMinVersion";
import { isUpdateRequired } from "../utils/versionCompare";
import { sendSuccess } from "../utils/response";

// Public endpoint — always 200 with a safe fail-open payload so a bad request
// or missing config never bricks the client.
const NO_UPDATE = { updateRequired: false, message: "", storeUrl: "" };

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

    return sendSuccess(res, 200, "Version check", {
      updateRequired,
      message: updateRequired ? config.message : "",
      storeUrl: config.storeUrl,
    });
  } catch (error) {
    console.error("Error checking app version", error);
    // Fail open: never block the client because of a server error.
    return sendSuccess(res, 200, "Version check", NO_UPDATE);
  }
};
