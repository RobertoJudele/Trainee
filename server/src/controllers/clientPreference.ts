import { Request, Response } from "express";
import { ClientPreference } from "../models/clientPreference";
import { Gym } from "../models/gym";
import { sendError, sendSuccess } from "../utils/response";

export const getMyPreferences = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 401, "User is not authenticated");
      return;
    }

    const preferences = await ClientPreference.findOne({
      where: { userId: req.user.id },
      include: [{ model: Gym, attributes: ["id", "name", "city", "state", "latitude", "longitude"] }],
    });

    sendSuccess(res, 200, "Preferences retrieved", preferences ?? null);
  } catch (error: unknown) {
    console.error("Get client preferences error:", error);
    sendError(res, 500, "Could not load preferences");
  }
};

export const upsertMyPreferences = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 401, "User is not authenticated");
      return;
    }

    const {
      preferredSpecializationIds,
      goals,
      fitnessLevel,
      budgetMin,
      budgetMax,
      preferredRateType,
      maxDistanceKm,
      preferredGymId,
    } = req.body;

    if (preferredGymId !== undefined && preferredGymId !== null) {
      const gym = await Gym.findByPk(preferredGymId);
      if (!gym) {
        sendError(res, 400, "Gym not found");
        return;
      }
    }

    const [preferences] = await ClientPreference.findOrCreate({
      where: { userId: req.user.id },
      defaults: { userId: req.user.id },
    });

    if (preferredSpecializationIds !== undefined) {
      preferences.preferredSpecializationIds = preferredSpecializationIds;
    }
    if (goals !== undefined) {
      preferences.goals = goals;
    }
    if (fitnessLevel !== undefined) {
      preferences.fitnessLevel = fitnessLevel;
    }
    if (budgetMin !== undefined) {
      preferences.budgetMin = budgetMin;
    }
    if (budgetMax !== undefined) {
      preferences.budgetMax = budgetMax;
    }
    if (preferredRateType !== undefined) {
      preferences.preferredRateType = preferredRateType;
    }
    if (maxDistanceKm !== undefined) {
      preferences.maxDistanceKm = maxDistanceKm;
    }
    if (preferredGymId !== undefined) {
      preferences.preferredGymId = preferredGymId ?? null;
    }

    await preferences.save();

    const result = await ClientPreference.findOne({
      where: { userId: req.user.id },
      include: [{ model: Gym, attributes: ["id", "name", "city", "state", "latitude", "longitude"] }],
    });

    sendSuccess(res, 200, "Preferences saved", result);
  } catch (error: unknown) {
    console.error("Upsert client preferences error:", error);
    sendError(res, 500, "Could not save preferences");
  }
};
