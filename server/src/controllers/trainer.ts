import { Request, Response } from "express";
import { TrainerProfileCreationAttributes } from "../types/trainer";
import { sendError, sendSuccess } from "../utils/response";
import { Trainer } from "../models/trainer";
import { Specialization } from "../models/specialization";
import { Op } from "sequelize";
import { User } from "../models/user";
import { UserRole } from "../types/common";
import { deleteTrainerProfilePicture } from "./trainerImages";
import { S3ImageService } from "../services/s3ImageService";
import { Sequelize } from "sequelize";
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
  sortBy?: "totalRating" | "experience" | "rate" | "reviews" | "recent";
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
    });
    const { userId: trainerUserId, id, ...trainerData } = trainer.toJSON();
    if (!trainer) {
      sendError(res, 400, "Creating trainer profile has failed");
    }
    sendSuccess(res, 200, "Trainer profile created succesfully", trainerData);
  } catch (error: any) {
    console.error("Error at creating trainer profile", error);
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err: any) => ({
        field: err.path,
        message: err.message,
      }));
      sendError(res, 400, "Validation trainer error ");
      return;
    }
    sendError(res, 500, "Unexpected error while creating trainer happened");
  }
};

export const getTrainer = async (
  req: Request<{ trainerId: string }, {}, {}>,
  res: Response
) => {
  const trainerId = parseInt(req.params.trainerId);

  if (!trainerId) {
    sendError(res, 400, "The trainer id is invalid");
    return;
  }
  const trainer = await Trainer.findByPk(trainerId);
  if (!trainer) {
    sendError(res, 404, "Trainer not found ");
    return;
  }

  res.json(trainer);
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
      latitude,
      longitude,
    } = req.body;
    if (!userId) {
      sendError(res, 404, "User id not found");
      return;
    }

    const user = User.findByPk(userId);
    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }

    const trainer = await Trainer.findOne({ where: { userId: userId } });
    if (!trainer) {
      sendError(res, 404, "The user doesnt have a trainer profile");
      return;
    }

    await trainer.update({
      bio: bio || trainer.bio,
      experienceYears: experienceYears || trainer.experienceYears,
      hourlyRate: hourlyRate || trainer.hourlyRate,
      sessionRate: sessionRate || trainer.sessionRate,
      locationCity: locationCity || trainer.locationCity,
      latitude: latitude || trainer.latitude,
      longitude: longitude || trainer.longitude,
    });
    sendSuccess(res, 200, "Trainer updated succesfully");
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

    const trainerWhere: any = {};
    const userWhere: any = {};

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

    // Text search — bio on trainer, name on user
    if (q) {
      trainerWhere[Op.or] = [{ bio: { [Op.iLike]: `%${q}%` } }];
      userWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${q}%` } },
        { lastName: { [Op.iLike]: `%${q}%` } },
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
      if (minRating) finalTrainerWhere.totalRating = { [Op.gte]: parseFloat(minRating) };
    }

    const { count, rows } = await Trainer.findAndCountAll({
      where: finalTrainerWhere,
      limit: parseInt(limit),
      offset,
      attributes: [
        "id",
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
          required: true,
        },
        {
          model: TrainerImage,
          attributes: ["imageUrl", "isPrimary"],
          required: false,
        },
      ],
      order: [[safeSortBy, safeSortOrder]],
      distinct: true,
    });

    // Fetch specializations separately for the returned trainers
    const trainerIds = rows.map((t) => t.id);
    const specializationsMap = await getSpecializationsForTrainers(trainerIds);

    const trainersData = rows.map((trainer) => {
      const json = trainer.toJSON() as any;
      return {
        bio: json.bio,
        experienceYears: json.experienceYears,
        hourlyRate: json.hourlyRate,
        sessionRate: json.sessionRate,
        locationCity: json.locationCity,
        locationState: json.locationState,
        locationCountry: json.locationCountry,
        latitude: json.latitude,
        longitude: json.longitude,
        isAvailable: json.isAvailable,
        isFeatured: json.isFeatured,
        profileViews: json.profileViews,
        totalRating: json.totalRating,
        reviewCount: json.reviewCount,
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
