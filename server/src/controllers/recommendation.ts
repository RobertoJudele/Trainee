import { Request, Response } from "express";
import { Op } from "sequelize";
import { Trainer } from "../models/trainer";
import { TrainerSpecialization } from "../models/trainerSpecialization";
import { Specialization } from "../models/specialization";
import { TrainerImage } from "../models/trainerImage";
import { ClientPreference } from "../models/clientPreference";
import { Gym } from "../models/gym";
import { TrainerGym } from "../models/trainerGym";
import { User } from "../models/user";
import { subStatus } from "../types/trainer";
import { sendError, sendSuccess } from "../utils/response";
import { toFiniteNumber } from "../utils/geo";

interface SuggestQuery {
  page?: string;
  limit?: string;
}

// Relative importance of each signal. They don't need to sum to any
// particular total — only their ratios to each other matter.
const WEIGHTS = {
  specialization: 35,
  rating: 20,
  distance: 20,
  price: 15,
  experienceLevel: 10,
};

const FEATURED_BONUS = 4;
const AVAILABLE_BONUS = 3;

const DEFAULT_MAX_DISTANCE_KM = 50;

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const FITNESS_LEVEL_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  expert: 2,
};

const getTrainerSpecializations = async (trainerIds: number[]) => {
  if (trainerIds.length === 0)
    return new Map<number, { specializationId: number; experienceLevel: string; specialization: any }[]>();

  const rows = await TrainerSpecialization.findAll({
    where: { trainerId: { [Op.in]: trainerIds } },
    include: [{ model: Specialization, attributes: ["id", "name", "description", "iconUrl"] }],
  });

  const map = new Map<number, { specializationId: number; experienceLevel: string; specialization: any }[]>();
  for (const row of rows) {
    const list = map.get(row.trainerId) ?? [];
    list.push({
      specializationId: row.specializationId,
      experienceLevel: row.experienceLevel,
      specialization: row.specialization?.toJSON(),
    });
    map.set(row.trainerId, list);
  }
  return map;
};

export const suggestTrainers = async (req: Request<{}, {}, {}, SuggestQuery>, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 401, "User is not authenticated");
      return;
    }

    const { page = "1", limit = "10" } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));

    const preferences = await ClientPreference.findOne({
      where: { userId: req.user.id },
      include: [{ model: Gym }],
    });

    const trainers = await Trainer.findAll({
      where: {
        [Op.or]: [
          { subscriptionStatus: subStatus.ACTIVE },
          { subscriptionStatus: subStatus.TRIAL, trialEndsAt: { [Op.gt]: new Date() } },
        ],
      },
      attributes: [
        "id",
        "publicId",
        "bio",
        "experienceYears",
        "hourlyRate",
        "sessionRate",
        "locationCity",
        "locationState",
        "locationCountry",
        "latitude",
        "longitude",
        "isAvailable",
        "isFeatured",
        "totalRating",
        "reviewCount",
      ],
      include: [
        {
          model: User,
          attributes: ["firstName", "lastName", "profileImageUrl"],
          required: true,
        },
        {
          model: TrainerImage,
          attributes: ["imageUrl", "isPrimary"],
          required: false,
        },
      ],
    });

    const specializationsByTrainer = await getTrainerSpecializations(trainers.map((t) => t.id));

    const preferredSpecIds = new Set(preferences?.preferredSpecializationIds ?? []);
    const hasPreferredSpecs = preferredSpecIds.size > 0;

    const gymLat = toFiniteNumber(preferences?.gym?.latitude ?? undefined);
    const gymLng = toFiniteNumber(preferences?.gym?.longitude ?? undefined);
    const hasGymLocation = gymLat !== undefined && gymLng !== undefined;
    const maxDistanceKm = toFiniteNumber(preferences?.maxDistanceKm ?? undefined) ?? DEFAULT_MAX_DISTANCE_KM;

    let trainersAtPreferredGym = new Set<number>();
    if (preferences?.preferredGymId) {
      const affiliations = await TrainerGym.findAll({
        where: {
          gymId: preferences.preferredGymId,
          isAvailable: true,
          trainerId: { [Op.in]: trainers.map((t) => t.id) },
        },
        attributes: ["trainerId"],
      });
      trainersAtPreferredGym = new Set(affiliations.map((a) => a.trainerId));
    }

    const rateType = preferences?.preferredRateType ?? "session";
    const budgetMin = toFiniteNumber(preferences?.budgetMin ?? undefined);
    const budgetMax = toFiniteNumber(preferences?.budgetMax ?? undefined);
    const hasBudget = budgetMin !== undefined || budgetMax !== undefined;

    const fitnessLevel = preferences?.fitnessLevel ?? null;

    const scored = trainers.map((trainer) => {
      const json = trainer.toJSON() as any;
      const trainerSpecs = specializationsByTrainer.get(trainer.id) ?? [];

      // Specialization overlap with the client's stated interests.
      let specializationScore = 0.5;
      if (hasPreferredSpecs) {
        const matchingSpecs = trainerSpecs.filter((s) => preferredSpecIds.has(s.specializationId));
        specializationScore = clamp01(matchingSpecs.length / preferredSpecIds.size);
      }

      // Rating, blended toward neutral for trainers with few reviews so new
      // trainers aren't buried under a single 5-star review.
      const reviewCount = json.reviewCount ?? 0;
      const totalRating = toFiniteNumber(json.totalRating) ?? 0;
      const confidence = clamp01(reviewCount / 10);
      const ratingScore = (totalRating / 5) * confidence + 0.5 * (1 - confidence);

      // Distance — relative to the client's preferred gym. Trainers who work
      // at that gym get a perfect score; otherwise fall back to the
      // trainer's own location vs the gym's, and neutral if neither is known.
      const worksAtPreferredGym = trainersAtPreferredGym.has(trainer.id);
      let distanceScore = 0.5;
      let distanceKm: number | undefined;
      if (worksAtPreferredGym) {
        distanceScore = 1;
        distanceKm = 0;
      } else {
        const trainerLat = toFiniteNumber(json.latitude);
        const trainerLng = toFiniteNumber(json.longitude);
        if (hasGymLocation && trainerLat !== undefined && trainerLng !== undefined) {
          distanceKm = haversineKm(gymLat!, gymLng!, trainerLat, trainerLng);
          distanceScore = clamp01(1 - distanceKm / maxDistanceKm);
        }
      }

      // Price fit against the client's budget for their preferred rate type.
      let priceScore = 0.5;
      const rate = toFiniteNumber(rateType === "hourly" ? json.hourlyRate : json.sessionRate);
      if (hasBudget && rate !== undefined) {
        if (
          (budgetMin === undefined || rate >= budgetMin) &&
          (budgetMax === undefined || rate <= budgetMax)
        ) {
          priceScore = 1;
        } else {
          const reference = budgetMax ?? budgetMin ?? rate;
          const overshoot =
            budgetMax !== undefined && rate > budgetMax
              ? rate - budgetMax
              : budgetMin !== undefined && rate < budgetMin
              ? budgetMin - rate
              : 0;
          priceScore = clamp01(1 - overshoot / Math.max(reference, 1));
        }
      }

      // Experience level — average how closely the trainer's level on the
      // client's preferred specializations matches the client's own level.
      let experienceScore = 0.5;
      if (fitnessLevel) {
        const relevantSpecs = hasPreferredSpecs
          ? trainerSpecs.filter((s) => preferredSpecIds.has(s.specializationId))
          : trainerSpecs;
        if (relevantSpecs.length > 0) {
          const clientRank = FITNESS_LEVEL_RANK[fitnessLevel] ?? 1;
          const diffs = relevantSpecs.map((s) => {
            const trainerRank = FITNESS_LEVEL_RANK[s.experienceLevel] ?? 1;
            return 1 - Math.abs(trainerRank - clientRank) / 2;
          });
          experienceScore = diffs.reduce((sum, v) => sum + v, 0) / diffs.length;
        }
      }

      const totalScore =
        specializationScore * WEIGHTS.specialization +
        ratingScore * WEIGHTS.rating +
        distanceScore * WEIGHTS.distance +
        priceScore * WEIGHTS.price +
        experienceScore * WEIGHTS.experienceLevel +
        (json.isFeatured ? FEATURED_BONUS : 0) +
        (json.isAvailable ? AVAILABLE_BONUS : 0);

      return {
        id: trainer.publicId || String(trainer.id),
        internalId: trainer.id,
        bio: json.bio,
        experienceYears: json.experienceYears,
        hourlyRate: json.hourlyRate,
        sessionRate: json.sessionRate,
        locationCity: json.locationCity,
        locationState: json.locationState,
        locationCountry: json.locationCountry,
        isAvailable: json.isAvailable,
        isFeatured: json.isFeatured,
        totalRating: json.totalRating,
        reviewCount: json.reviewCount,
        user: json.user,
        images: json.images ?? [],
        specializations: trainerSpecs.map((s) => ({
          ...s.specialization,
          experienceLevel: s.experienceLevel,
        })),
        distanceKm,
        worksAtPreferredGym,
        matchScore: Math.round(totalScore * 10) / 10,
        matchPercent: Math.min(100, Math.round(totalScore)),
        matchBreakdown: {
          specialization: Math.round(specializationScore * 100) / 100,
          rating: Math.round(ratingScore * 100) / 100,
          distance: Math.round(distanceScore * 100) / 100,
          price: Math.round(priceScore * 100) / 100,
          experienceLevel: Math.round(experienceScore * 100) / 100,
        },
      };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);

    const total = scored.length;
    const offset = (pageNum - 1) * limitNum;
    const page_ = scored.slice(offset, offset + limitNum);
    const totalPages = Math.ceil(total / limitNum);

    sendSuccess(res, 200, "Suggestions retrieved", {
      trainers: page_,
      hasPreferences: !!preferences,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: totalPages > pageNum,
        hasPreviousPage: pageNum > 1,
      },
    });
  } catch (error: unknown) {
    console.error("Suggest trainers error:", error);
    sendError(res, 500, "Could not load suggestions");
  }
};
