import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { TrainerProfileCreationAttributes, subStatus } from "../types/trainer";
import { sendError, sendSuccess } from "../utils/response";
import { Trainer } from "../models/trainer";
import { Specialization } from "../models/specialization";
import { Op } from "sequelize";
import { User } from "../models/user";
import { UserRole } from "../types/common";
import { deleteTrainerProfilePicture } from "./trainerImages";
import { S3ImageService } from "../services/s3ImageService";
import { Sequelize } from "sequelize";
import "../utils/helper";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { s3, S3_CONFIG } from "../config/s3";
import { TrainerImage } from "../models/trainerImage";
import { TrainerSpecialization } from "../models/trainerSpecialization";
import { TrainerGym } from "../models/trainerGym";
import { Gym } from "../models/gym";
import { stripe } from "../config/stripe";
import {
  buildPointFromLatLng,
  isValidLatitude,
  isValidLongitude,
  toFiniteNumber,
} from "../utils/geo";
import { get } from "http";


interface SearchQuery {
  // Text search
  q?: string; // General search query

  // Location filters
  city?: string;
  state?: string;
  country?: string;
  lat?: string;
  lng?: string;
  radius?: string; // in km
  radiusKm?: string;

  // Rate filters
  minRate?: string;
  maxRate?: string;
  rateType?: "hourly" | "session"; // Which rate to filter by

  // Experience filters
  minExperience?: string;
  maxExperience?: string;

  // Rating filters
  minRating?: string;

  // Specialization filters
  specializations?: string; // Comma-separated IDs

  // Availability
  isAvailable?: string; // 'true' or 'false'
  isFeatured?: string;

  // Sorting
  sortBy?:
    | "totalRating"
    | "experienceYears"
    | "hourlyRate"
    | "sessionRate"
    | "reviewCount"
    | "createdAt"
    | "distance";
  sortOrder?: "asc" | "desc";

  // Pagination
  page?: string;
  limit?: string;
}

const getSpecializationsForTrainers = async (trainerIds: number[]) => {
  if (trainerIds.length === 0) return new Map();

  const trainerSpecializations = await TrainerSpecialization.findAll({
    where: { trainerId: trainerIds },
    include: [
      {
        model: Specialization,
        attributes: ["id", "name", "description", "iconUrl"],
      },
    ],
    raw: false, // Important: get full model instances
  });

  // Group by trainerId
  const map = new Map<number, any[]>();

  trainerSpecializations.forEach((ts) => {
    if (!map.has(ts.trainerId)) {
      map.set(ts.trainerId, []);
    }

    // Create a combined object with specialization + through data
    const specWithThrough = {
      ...ts.specialization.toJSON(),
      TrainerSpecialization: {
        experienceLevel: ts.experienceLevel,
        certification: ts.certification,
      },
    };

    map.get(ts.trainerId)!.push(specWithThrough);
  });

  return map;
};

const ensureTrainerPublicId = async (trainer: Trainer): Promise<string> => {
  if (trainer.publicId) {
    return trainer.publicId;
  }

  const generated = randomUUID();
  console.log(`!!!!!!!!!!!!!!Generated publicId ${generated} for trainer ${trainer.id}`);
  await trainer.update({ publicId: generated });
  return generated;
};

export const createTrainer = async (
  req: Request<{}, {}, TrainerProfileCreationAttributes>,
  res: Response
) => {
  try {
    const userId = req.user.id;
    const { specializationIds, ...profileData } = req.body;

    if (req.user.role === "trainer") {
      sendError(res, 400, "You are a trainer already");
      return;
    }

    if (await Trainer.findOne({ where: { userId: req.user.id } })) {
      sendError(res, 400, "A trainer profile already exists");
      return;
    }

    if (specializationIds && specializationIds.length > 0) {
      const validSpecializations = await Specialization.findAll({
        where: { id: { [Op.in]: specializationIds }, isActive: true },
      });
      if (specializationIds?.length != validSpecializations.length) {
        sendError(res, 400, "One or more specializations are invalid");
        return;
      }
    }
    const user = await User.findByPk(userId);
    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }

    user.role = UserRole.TRAINER;
    await user.save();
    const currentDate = new Date();
    const trialEndsAt = currentDate;
    const stripeCustomer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: {
        userId: user.id.toString(), // Pro-tip: Link Stripe back to your DB ID
      }
    });
    const stripeCustomerId = stripeCustomer.id;
    const stripeSubscriptionId = "";
    const subscriptionStatus = subStatus.TRIAL;
    const currentPeriodEndsAt = null;

    const trainerLocation = buildPointFromLatLng(
      toFiniteNumber(profileData.latitude),
      toFiniteNumber(profileData.longitude)
    );

    const trainer = await Trainer.create({
      userId: userId,
      bio: profileData.bio,
      experienceYears: profileData.experienceYears,
      hourlyRate: profileData.hourlyRate,
      sessionRate: profileData.sessionRate,
      locationCity: profileData.locationCity,
      locationState: profileData.locationState,
      locationCountry: profileData.locationCountry,
      latitude: profileData.latitude,
      longitude: profileData.longitude,
      instagramUrl: profileData.instagramUrl,
      facebookUrl: profileData.facebookUrl,
      whatsappUrl: profileData.whatsappUrl,
      location: trainerLocation ?? undefined,
      trialEndsAt,
      stripeCustomerId,
      stripeSubscriptionId,
      subscriptionStatus,
    });

    if (specializationIds && specializationIds.length > 0) {
      const uniqueSpecializationIds = [...new Set(specializationIds)];
      await TrainerSpecialization.bulkCreate(
        uniqueSpecializationIds.map((specializationId) => ({
          trainerId: trainer.id,
          specializationId,
          experienceLevel: "beginner",
        }))
      );
    }

    const trainerWithSpecializations = await Trainer.findByPk(trainer.id, {
      attributes: { exclude: ["id", "userId"] },
      include: [
        {
          model: Specialization,
          attributes: ["id", "name", "description", "iconUrl"],
          through: { attributes: [] },
        },
      ],
    });

    const { userId: trainerUserId, id, ...trainerData } = trainer.toJSON();
    if (!trainer) {
      sendError(res, 400, "Creating trainer profile has failed");
    }
    sendSuccess(
      res,
      200,
      "Trainer profile created succesfully",
      (trainerWithSpecializations?.toJSON() as any) || trainerData
    );
  } catch (error: any) {
    console.error("Error at creating trainer profile", error);
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err: any) => ({
        field: err.path,
        message: err.message,
      }));
      sendError(res, 400, "Validation trainer error");
      return;
    }
    sendError(res, 500, "Unexpected error while creating trainer happened");
  }
};

export const getTrainer = async (
  req: Request<{ trainerId: string }, {}, {}>,
  res: Response
) => {
  try {
    const trainerIdentifier = String(req.params.trainerId || "").trim();
    if (!trainerIdentifier) {
      sendError(res, 400, "The trainer id is invalid");
      return;
    }

    const numericTrainerId = Number(trainerIdentifier);
    const isNumericTrainerId = Number.isFinite(numericTrainerId) && numericTrainerId > 0;

    const trainerWhere = isNumericTrainerId
      ? { id: numericTrainerId }
      : { publicId: trainerIdentifier };

    const trainer = await Trainer.findOne({
      where: trainerWhere,
      attributes: [
        "id",
        "publicId",
        "userId",
        "bio",
        "experienceYears",
        "hourlyRate",
        "sessionRate",
        "locationCity",
        "locationState",
        "locationCountry",
        "latitude",
        "longitude",
        "instagramUrl",
        "facebookUrl",
        "whatsappUrl",
        "isFeatured",
        "isAvailable",
        "profileViews",
        "totalRating",
        "reviewCount",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: User,
          attributes: ["firstName", "lastName", "profileImageUrl"],
        },
      ],
    });

    if (!trainer) {
      sendError(res, 404, "Trainer not found ");
      return;
    }

    const publicId = await ensureTrainerPublicId(trainer);
    const trainerNumericId = trainer.id;

    const trainerGyms = await TrainerGym.findAll({
      where: { trainerId: trainerNumericId, isAvailable: true },
      include: [
        {
          model: Gym,
          attributes: [
            "id",
            "name",
            "address",
            "city",
            "state",
            "country",
            "latitude",
            "longitude",
            "rating",
            "reviewCount",
            "imageUrl",
          ],
        },
      ],
    });

    const availableGyms = trainerGyms
      .map((entry) => (entry.gym as any)?.toJSON?.())
      .filter(Boolean);

    const payload = {
      ...(trainer.toJSON() as any),
      id: publicId,
      internalId: trainerNumericId,
      availableGyms,
    };

    res.json(payload);
  } catch (error: any) {
    console.error("Error while fetching public trainer details", error);
    sendError(res, 500, "Failed to retrieve trainer details");
  }
};

export const deleteTrainer = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const trainer = await Trainer.findOne({ where: { userId: userId } });

    const user = await User.findByPk(userId);

    if (!user) {
      sendError(res, 404, "User nmot found");
      return;
    }

    if (!trainer) {
      sendError(res, 404, "No trainer found");
      return;
    }
    const profilePictureUrl = user.profileImageUrl;
    if (profilePictureUrl) {
      const folderPrefix = `profilePicture/${userId}/`;

      const listCommand = new ListObjectsV2Command({
        Bucket: S3_CONFIG.bucket,
        Prefix: folderPrefix,
      });
      const listResponse = await s3.send(listCommand);
      console.log("📋 S3 list response:", listResponse);

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        console.log(`No files found for user ${userId}`);

        console.log("Destroying trainer with no files");
        await trainer.destroy();

        user.role = UserRole.CLIENT;
        await user.save();

        sendSuccess(res, 200, "Trainer deleted succesfully");
        return;
      }

      // Prepare objects for batch deletion
      const objectsToDelete = listResponse.Contents.map((obj) => ({
        Key: obj.Key!,
      }));

      // Delete all objects in batch (more efficient)
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: S3_CONFIG.bucket,
        Delete: {
          Objects: objectsToDelete,
        },
      });

      const deleteResponse = await s3.send(deleteCommand);

      console.log(
        `✅ Deleted ${objectsToDelete.length} files for user ${userId}`
      );

      if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
        console.warn("Some files failed to delete:", deleteResponse.Errors);
      }
    }
    console.log("Destroying trainer");
    await trainer.destroy();

    user.role = UserRole.CLIENT;
    await user.save();

    sendSuccess(res, 200, "Trainer deleted succesfully");
  } catch (error: any) {
    console.error("Error at deleting trainer", error);
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err: any) => ({
        path: err.fields,
        message: err.message,
      }));
      sendError(res, 400, "Validation error: ", errors);
      return;
    }
    sendError(res, 500, "Unknown errot at deleting trainer");
  }
};

export const updateTrainer = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const {
      bio,
      experienceYears,
      hourlyRate,
      sessionRate,
      locationCity,
      locationState,
      locationCountry,
      latitude,
      longitude,
      instagramUrl,
      facebookUrl,
      whatsappUrl,
      specializationIds,
    } = req.body;
    if (!userId) {
      sendError(res, 404, "User id not found");
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }

    const trainer = await Trainer.findOne({ where: { userId: userId } });
    if (!trainer) {
      sendError(res, 404, "The user doesnt have a trainer profile");
      return;
    }

    const providedLatitude = toFiniteNumber(latitude);
    const providedLongitude = toFiniteNumber(longitude);

    if (
      latitude !== undefined &&
      (providedLatitude === undefined || !isValidLatitude(providedLatitude))
    ) {
      sendError(res, 400, "Latitude must be between -90 and 90.");
      return;
    }

    if (
      longitude !== undefined &&
      (providedLongitude === undefined || !isValidLongitude(providedLongitude))
    ) {
      sendError(res, 400, "Longitude must be between -180 and 180.");
      return;
    }

    const nextLatitude = providedLatitude ?? toFiniteNumber(trainer.latitude);
    const nextLongitude = providedLongitude ?? toFiniteNumber(trainer.longitude);
    const nextLocation = buildPointFromLatLng(nextLatitude, nextLongitude);
    const nextInstagramUrl =
      instagramUrl === undefined ? trainer.instagramUrl : instagramUrl || null;
    const nextFacebookUrl =
      facebookUrl === undefined ? trainer.facebookUrl : facebookUrl || null;
    const nextWhatsappUrl =
      whatsappUrl === undefined ? trainer.whatsappUrl : whatsappUrl || null;

    await trainer.update({
      bio: bio ?? trainer.bio,
      experienceYears: experienceYears ?? trainer.experienceYears,
      hourlyRate: hourlyRate ?? trainer.hourlyRate,
      sessionRate: sessionRate ?? trainer.sessionRate,
      locationCity: locationCity ?? trainer.locationCity,
      locationState: locationState ?? trainer.locationState,
      locationCountry: locationCountry ?? trainer.locationCountry,
      latitude: nextLatitude ?? trainer.latitude,
      longitude: nextLongitude ?? trainer.longitude,
      instagramUrl: nextInstagramUrl,
      facebookUrl: nextFacebookUrl,
      whatsappUrl: nextWhatsappUrl,
      location: nextLocation ?? trainer.location,
    });

    if (Array.isArray(specializationIds)) {
      const uniqueSpecializationIds = [...new Set(specializationIds)].filter(
        (id) => Number.isInteger(id) && id > 0
      );

      const validSpecializations = await Specialization.findAll({
        where: { id: { [Op.in]: uniqueSpecializationIds }, isActive: true },
        attributes: ["id"],
      });

      if (uniqueSpecializationIds.length !== validSpecializations.length) {
        sendError(res, 400, "One or more specializations are invalid");
        return;
      }

      await TrainerSpecialization.destroy({ where: { trainerId: trainer.id } });

      if (uniqueSpecializationIds.length > 0) {
        await TrainerSpecialization.bulkCreate(
          uniqueSpecializationIds.map((specializationId) => ({
            trainerId: trainer.id,
            specializationId,
            experienceLevel: "beginner",
          }))
        );
      }
    }

    const updatedTrainer = await Trainer.findByPk(trainer.id, {
      attributes: { exclude: ["id", "userId"] },
      include: [
        {
          model: Specialization,
          attributes: ["id", "name", "description", "iconUrl"],
          through: { attributes: [] },
        },
      ],
    });

    sendSuccess(
      res,
      200,
      "Trainer updated succesfully",
      updatedTrainer?.toJSON() as any
    );
  } catch (error: any) {
    console.error("Error at updating trainer", error);
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err: any) => ({
        path: err.fields,
        message: err.message,
      }));
      sendError(res, 400, "Validation error: ", errors);
      return;
    }
    sendError(res, 500, "Unknown errot at updating trainer");
  }
};

export const getSelfTrainer = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      sendError(res, 404, "User not found!");
      return;
    }

    const trainer = await Trainer.findOne({
      where: { userId: userId },
      attributes: { exclude: ["id", "userId"] },
      include: [
        {
          model: Specialization,
          attributes: ["id", "name", "description", "iconUrl"],
          through: { attributes: [] },
        },
      ],
    });
    if (!trainer) {
      sendError(res, 404, "Trainer for this profile doesnt exist!");
      return;
    }

    sendSuccess(res, 200, "Trainer profile retrieved successfully", trainer);
  } catch (error: any) {
    console.error("Error at  getting self trainer", error);
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err: any) => ({
        path: err.fields,
        message: err.message,
      }));
      sendError(res, 400, "Validation error: ", errors);
      return;
    }
    sendError(res, 500, "Unknown errot at getting self trainer");
  }
};

export const searchTrainers = async (
  req: Request<{}, {}, {}, SearchQuery>,
  res: Response
) => {
  try {
    const {
      q,
      city,
      state,
      country,
      lat,
      lng,
      radius,
      radiusKm,
      minRate,
      maxRate,
      rateType = "session",
      minExperience,
      maxExperience,
      minRating,
      specializations,
      isAvailable,
      isFeatured,
      sortBy = "totalRating",
      sortOrder = "desc",
      page = "1",
      limit = "20",
    } = req.query;

    const trainerWhere: any = {
      subscriptionStatus: { [Op.in]: [subStatus.ACTIVE, subStatus.TRIAL] },
    };
    const userWhere: any = {};

    const latValue = toFiniteNumber(lat);
    const lngValue = toFiniteNumber(lng);
    const radiusValue = toFiniteNumber(radiusKm ?? radius);

    const hasGeoReference =
      latValue !== undefined &&
      lngValue !== undefined &&
      isValidLatitude(latValue) &&
      isValidLongitude(lngValue);

    if ((lat !== undefined || lng !== undefined) && !hasGeoReference) {
      sendError(res, 400, "lat/lng must be valid coordinates");
      return;
    }

    if ((radius !== undefined || radiusKm !== undefined) && (!radiusValue || radiusValue <= 0)) {
      sendError(res, 400, "radius must be a positive number in kilometers");
      return;
    }

    const hasRadiusFilter = hasGeoReference && radiusValue !== undefined && radiusValue > 0;
    const distanceExpression = hasGeoReference
      ? `
          ST_Distance(
            "Trainer"."location"::geography,
            ST_SetSRID(ST_MakePoint(${lngValue}, ${latValue}), 4326)::geography
          )
        `
      : null;

    const applyGeoFilters = (whereClause: any): void => {
      if (!hasGeoReference) {
        return;
      }

      whereClause.location = { [Op.ne]: null };

      if (hasRadiusFilter) {
        const existingAnd = Array.isArray(whereClause[Op.and]) ? whereClause[Op.and] : [];
        whereClause[Op.and] = [
          ...existingAnd,
          Sequelize.literal(`
            ST_DWithin(
              "Trainer"."location"::geography,
              ST_SetSRID(ST_MakePoint(${lngValue}, ${latValue}), 4326)::geography,
              ${radiusValue! * 1000}
            )
          `),
        ];
      }
    };

    if (isAvailable === "true") trainerWhere.isAvailable = true;
    if (isFeatured === "true") trainerWhere.isFeatured = true;

    // Location filters
    if (city) trainerWhere.locationCity = { [Op.iLike]: `%${city}%` };
    if (state) trainerWhere.locationState = { [Op.iLike]: `%${state}%` };
    if (country) trainerWhere.locationCountry = { [Op.iLike]: `%${country}%` };

    // Rate filters
    if (minRate || maxRate) {
      const rateField = rateType === "hourly" ? "hourlyRate" : "sessionRate";
      trainerWhere[rateField] = {};
      if (minRate) trainerWhere[rateField][Op.gte] = parseFloat(minRate);
      if (maxRate) trainerWhere[rateField][Op.lte] = parseFloat(maxRate);
    }

    // Experience filters
    if (minExperience || maxExperience) {
      trainerWhere.experienceYears = {};
      if (minExperience) trainerWhere.experienceYears[Op.gte] = parseInt(minExperience);
      if (maxExperience) trainerWhere.experienceYears[Op.lte] = parseInt(maxExperience);
    }

    // Rating filter
    if (minRating) {
      trainerWhere.totalRating = { [Op.gte]: parseFloat(minRating) };
    }

    applyGeoFilters(trainerWhere);

    // Text search — bio on trainer, name on user
    if (q) {
      const normalizedQuery = String(q).trim();
      trainerWhere[Op.or] = [
        { bio: { [Op.iLike]: `%${normalizedQuery}%` } },
        { publicId: { [Op.iLike]: `%${normalizedQuery}%` } },
      ];
      userWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${normalizedQuery}%` } },
        { lastName: { [Op.iLike]: `%${normalizedQuery}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const validSortFields = [
      "totalRating",
      "experienceYears",
      "hourlyRate",
      "sessionRate",
      "reviewCount",
      "createdAt",
      "distance",
    ];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "totalRating";
    const safeSortOrder = sortOrder === "asc" ? "ASC" : "DESC";

    // Specialization filter — find trainer IDs that have ALL requested specializations
    let specializationTrainerIds: number[] | null = null;
    if (specializations) {
      const specIds = specializations
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));

      if (specIds.length > 0) {
        const matches = await TrainerSpecialization.findAll({
          where: { specializationId: { [Op.in]: specIds } },
          attributes: ["trainerId"],
          group: ["trainerId"],
          having: Sequelize.literal(`COUNT(DISTINCT "specialization_id") = ${specIds.length}`),
        });
        specializationTrainerIds = matches.map((m) => m.trainerId);

        // If no trainers match, return empty immediately
        if (specializationTrainerIds.length === 0) {
          return sendSuccess(res, 200, "Search result successful", {
            trainers: [],
            pagination: {
              total: 0,
              page: parseInt(page),
              limit: parseInt(limit),
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          });
        }

        trainerWhere.id = { [Op.in]: specializationTrainerIds };
      }
    }

    // When text searching by name, we need to OR across trainer bio + user name.
    // Strategy: if q is set, run two queries and merge IDs.
    let finalTrainerWhere = { ...trainerWhere };

    if (q) {
      // Find trainer IDs matching by user name
      const userMatches = await User.findAll({
        where: userWhere,
        attributes: ["id"],
      });
      const userIds = userMatches.map((u: any) => u.id);

      const trainersByName = await Trainer.findAll({
        where: { userId: { [Op.in]: userIds } },
        attributes: ["id"],
      });
      const trainerIdsByName = trainersByName.map((t) => t.id);

      // Combine: trainers matching bio OR name
      const { [Op.or]: bioOr, ...restWhere } = trainerWhere;
      const bioTrainerWhere = { ...restWhere, [Op.or]: bioOr };

      const trainersByBio = await Trainer.findAll({
        where: bioTrainerWhere,
        attributes: ["id"],
      });
      const trainerIdsByBio = trainersByBio.map((t) => t.id);

      const combinedIds = [...new Set([...trainerIdsByName, ...trainerIdsByBio])];

      // Merge with specialization filter if active
      if (specializationTrainerIds !== null) {
        const specSet = new Set(specializationTrainerIds);
        finalTrainerWhere = { id: { [Op.in]: combinedIds.filter((id) => specSet.has(id)) } };
      } else {
        finalTrainerWhere = { id: { [Op.in]: combinedIds } };
      }

      // Re-apply non-text filters
      finalTrainerWhere.subscriptionStatus = {
        [Op.in]: [subStatus.ACTIVE, subStatus.TRIAL],
      };
      if (isAvailable === "true") finalTrainerWhere.isAvailable = true;
      if (isFeatured === "true") finalTrainerWhere.isFeatured = true;
      if (city) finalTrainerWhere.locationCity = { [Op.iLike]: `%${city}%` };
      if (state) finalTrainerWhere.locationState = { [Op.iLike]: `%${state}%` };
      if (country) finalTrainerWhere.locationCountry = { [Op.iLike]: `%${country}%` };
      if (minRate || maxRate) {
        const rateField = rateType === "hourly" ? "hourlyRate" : "sessionRate";
        finalTrainerWhere[rateField] = {};
        if (minRate) finalTrainerWhere[rateField][Op.gte] = parseFloat(minRate);
        if (maxRate) finalTrainerWhere[rateField][Op.lte] = parseFloat(maxRate);
      }
      if (minExperience || maxExperience) {
        finalTrainerWhere.experienceYears = {};
        if (minExperience) finalTrainerWhere.experienceYears[Op.gte] = parseInt(minExperience);
        if (maxExperience) finalTrainerWhere.experienceYears[Op.lte] = parseInt(maxExperience);
      }
      if (minRating) finalTrainerWhere.totalRating = { [Op.gte]: parseFloat(minRating) };

      applyGeoFilters(finalTrainerWhere);
    }

    const trainerAttributes: any[] = [
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
      "instagramUrl",
      "facebookUrl",
      "whatsappUrl",
      "isAvailable",
      "isFeatured",
      "profileViews",
      "totalRating",
      "reviewCount",
      "createdAt",
      "updatedAt",
    ];

    if (distanceExpression) {
      trainerAttributes.push([Sequelize.literal(distanceExpression), "distanceMeters"]);
    }

    const resolvedSortBy = safeSortBy === "distance" && !distanceExpression ? "totalRating" : safeSortBy;
    const orderClause: any[] =
      resolvedSortBy === "distance" && distanceExpression
        ? [[Sequelize.literal(distanceExpression), safeSortOrder], ["totalRating", "DESC"]]
        : [[resolvedSortBy, safeSortOrder]];

    const { count, rows } = await Trainer.findAndCountAll({
      where: finalTrainerWhere,
      limit: parseInt(limit),
      offset,
      attributes: trainerAttributes,
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
      order: orderClause,
      distinct: true,
    });

    // Fetch specializations separately for the returned trainers
    const trainerIds = rows.map((t) => t.id);
    await Promise.all(rows.map((trainer) => ensureTrainerPublicId(trainer)));
    const specializationsMap = await getSpecializationsForTrainers(trainerIds);

    const trainersData = rows.map((trainer) => {
      const json = trainer.toJSON() as any;
      const distanceMeters = toFiniteNumber(json.distanceMeters);

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
        latitude: json.latitude,
        longitude: json.longitude,
        instagramUrl: json.instagramUrl,
        facebookUrl: json.facebookUrl,
        whatsappUrl: json.whatsappUrl,
        isAvailable: json.isAvailable,
        isFeatured: json.isFeatured,
        profileViews: json.profileViews,
        totalRating: json.totalRating,
        reviewCount: json.reviewCount,
        distanceKm:
          distanceMeters !== undefined
            ? Number((distanceMeters / 1000).toFixed(2))
            : undefined,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
        user: json.user,
        images: json.images ?? [],
        specializations: specializationsMap.get(trainer.id) ?? [],
      };
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    sendSuccess(res, 200, "Search result successful", {
      trainers: trainersData,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNextPage: totalPages > parseInt(page),
        hasPreviousPage: parseInt(page) > 1,
      },
    });
  } catch (error: any) {
    console.error("Search trainers error:", error);
    sendError(res, 500, "Search failed");
  }
};
