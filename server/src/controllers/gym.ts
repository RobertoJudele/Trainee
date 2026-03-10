import { Request, Response } from "express";
import { Op } from "sequelize";
import { Gym } from "../models/gym";
import { TrainerGym } from "../models/trainerGym";
import { Trainer } from "../models/trainer";
import { User } from "../models/user";
import { sendError, sendSuccess } from "../utils/response";
import { AuthenticatedRequest } from "../types/common";

// ─────────────────────────────────────────────
// GET /gyms  — all active gyms (map markers)
// Returns minimal data needed to render markers
// ─────────────────────────────────────────────
export const getAllGyms = async (req: Request, res: Response) => {
  try {
    const gyms = await Gym.findAll({
      where: { isActive: true },
      attributes: [
        "id", "name", "address", "city", "state",
        "latitude", "longitude", "rating", "reviewCount",
        "openingHours", "phone", "imageUrl",
      ],
      order: [["name", "ASC"]],
    });

    // Attach available trainer count to each gym
    const gymIds = gyms.map((g) => g.id);
    const counts = await TrainerGym.findAll({
      where: { gymId: { [Op.in]: gymIds }, isAvailable: true },
      attributes: ["gymId"],
    });

    const countMap = counts.reduce<Record<number, number>>((acc, tg) => {
      acc[tg.gymId] = (acc[tg.gymId] ?? 0) + 1;
      return acc;
    }, {});

    const data = gyms.map((g) => ({
      ...g.toJSON(),
      availableTrainerCount: countMap[g.id] ?? 0,
    }));

    sendSuccess(res, 200, "Gyms retrieved successfully", data);
  } catch (error) {
    console.error("getAllGyms error:", error);
    sendError(res, 500, "Failed to retrieve gyms");
  }
};

// ─────────────────────────────────────────────
// GET /gyms/:gymId  — single gym details + trainers
// ─────────────────────────────────────────────
export const getGymById = async (req: Request, res: Response) => {
  try {
    const gymId = parseInt(req.params.gymId);
    if (isNaN(gymId)) {
      sendError(res, 400, "Invalid gym id");
      return;
    }

    const gym = await Gym.findByPk(gymId, {
      attributes: [
        "id", "name", "address", "city", "state", "country",
        "latitude", "longitude", "phone", "openingHours",
        "imageUrl", "rating", "reviewCount", "isActive",
      ],
    });

    if (!gym) {
      sendError(res, 404, "Gym not found");
      return;
    }

    // Fetch trainers linked to this gym with their availability
    const trainerGyms = await TrainerGym.findAll({
      where: { gymId },
      include: [
        {
          model: Trainer,
          attributes: [
            "id", "bio", "experienceYears", "hourlyRate",
            "sessionRate", "totalRating", "reviewCount",
          ],
          include: [
            {
              model: User,
              attributes: ["firstName", "lastName", "profileImageUrl"],
            },
          ],
        },
      ],
    });

    const trainers = trainerGyms.map((tg) => {
      const trainerJson = (tg.trainer as any)?.toJSON?.() ?? {};
      return {
        ...trainerJson,
        isAvailableAtGym: tg.isAvailable,
      };
    });

    sendSuccess(res, 200, "Gym retrieved successfully", {
      ...gym.toJSON(),
      trainers,
    });
  } catch (error) {
    console.error("getGymById error:", error);
    sendError(res, 500, "Failed to retrieve gym");
  }
};

// ─────────────────────────────────────────────
// GET /gyms/my-gyms  — gyms the logged-in trainer joined
// ─────────────────────────────────────────────
export const getMyGyms = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const trainer = await Trainer.findOne({ where: { userId } });
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const trainerGyms = await TrainerGym.findAll({
      where: { trainerId: trainer.id },
      include: [
        {
          model: Gym,
          attributes: [
            "id", "name", "address", "city", "state",
            "latitude", "longitude", "openingHours", "imageUrl", "rating",
          ],
        },
      ],
    });

    const data = trainerGyms.map((tg) => ({
      ...(tg.gym as any)?.toJSON?.(),
      isAvailable: tg.isAvailable,
      trainerGymId: tg.id,
    }));

    sendSuccess(res, 200, "My gyms retrieved successfully", data);
  } catch (error) {
    console.error("getMyGyms error:", error);
    sendError(res, 500, "Failed to retrieve your gyms");
  }
};

// ─────────────────────────────────────────────
// POST /gyms/:gymId/join  — trainer joins a gym
// ─────────────────────────────────────────────
export const joinGym = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const gymId = parseInt(req.params.gymId);

    if (isNaN(gymId)) {
      sendError(res, 400, "Invalid gym id");
      return;
    }

    const trainer = await Trainer.findOne({ where: { userId } });
    if (!trainer) {
      sendError(res, 404, "You need a trainer profile first");
      return;
    }

    const gym = await Gym.findByPk(gymId);
    if (!gym || !gym.isActive) {
      sendError(res, 404, "Gym not found");
      return;
    }

    const existing = await TrainerGym.findOne({
      where: { trainerId: trainer.id, gymId },
    });
    if (existing) {
      sendError(res, 409, "You are already registered at this gym");
      return;
    }

    const trainerGym = await TrainerGym.create({
      trainerId: trainer.id,
      gymId,
      isAvailable: true,
    });

    sendSuccess(res, 201, "Successfully joined gym", trainerGym);
  } catch (error) {
    console.error("joinGym error:", error);
    sendError(res, 500, "Failed to join gym");
  }
};

// ─────────────────────────────────────────────
// PATCH /gyms/:gymId/availability  — toggle trainer availability at a gym
// ─────────────────────────────────────────────
export const setGymAvailability = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user!.id;
    const gymId = parseInt(req.params.gymId);
    const { isAvailable } = req.body as { isAvailable: boolean };

    if (isNaN(gymId)) {
      sendError(res, 400, "Invalid gym id");
      return;
    }

    if (typeof isAvailable !== "boolean") {
      sendError(res, 400, "isAvailable must be a boolean");
      return;
    }

    const trainer = await Trainer.findOne({ where: { userId } });
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const trainerGym = await TrainerGym.findOne({
      where: { trainerId: trainer.id, gymId },
    });

    if (!trainerGym) {
      sendError(res, 404, "You are not registered at this gym");
      return;
    }

    await trainerGym.update({ isAvailable });

    sendSuccess(res, 200, `Availability set to ${isAvailable}`, trainerGym);
  } catch (error) {
    console.error("setGymAvailability error:", error);
    sendError(res, 500, "Failed to update availability");
  }
};

// ─────────────────────────────────────────────
// DELETE /gyms/:gymId/leave  — trainer leaves a gym
// ─────────────────────────────────────────────
export const leaveGym = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const gymId = parseInt(req.params.gymId);

    if (isNaN(gymId)) {
      sendError(res, 400, "Invalid gym id");
      return;
    }

    const trainer = await Trainer.findOne({ where: { userId } });
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const trainerGym = await TrainerGym.findOne({
      where: { trainerId: trainer.id, gymId },
    });

    if (!trainerGym) {
      sendError(res, 404, "You are not registered at this gym");
      return;
    }

    await trainerGym.destroy();

    sendSuccess(res, 200, "Successfully left gym");
  } catch (error) {
    console.error("leaveGym error:", error);
    sendError(res, 500, "Failed to leave gym");
  }
};

// ─────────────────────────────────────────────
// POST /gyms  — admin creates a gym
// ─────────────────────────────────────────────
export const createGym = async (req: Request, res: Response) => {
  try {
    const {
      name, address, city, state, country,
      latitude, longitude, phone, openingHours, imageUrl,
    } = req.body;

    if (!name || !address || !city || latitude == null || longitude == null) {
      sendError(res, 400, "name, address, city, latitude and longitude are required");
      return;
    }

    const gym = await Gym.create({
      name, address, city, state, country,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      phone, openingHours, imageUrl,
    });

    sendSuccess(res, 201, "Gym created successfully", gym);
  } catch (error) {
    console.error("createGym error:", error);
    sendError(res, 500, "Failed to create gym");
  }
};