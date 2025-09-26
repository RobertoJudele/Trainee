import { Request, Response } from "express";
import { TrainerProfileCreationAttributes } from "../types/trainer";
import { sendError, sendSuccess } from "../utils/response";
import { Trainer } from "../models/trainer";
import { Specialization } from "../models/specialization";
import { Op } from "sequelize";
import { User } from "../models/user";
import { UserRole } from "../types/common";

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

    if (!trainer) {
      sendError(res, 400, "Creating trainer profile has failed");
    }
    sendSuccess(res, 200, "Trainer profile created succesfully");
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
