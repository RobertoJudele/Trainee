import { Request, Response } from "express";
import { Op, where } from "sequelize";
import { Trainer } from "../models/trainer";
import { AuthenticatedRequest } from "src/types/common";
import { TrainerSpecializationCreationAttributes } from "src/types/trainerSpecialization";
import { sendError, sendSuccess } from "src/utils/response";
import { Specialization } from "src/models/specialization";
import { TrainerSpecialization } from "src/models/trainerSpecialization";
import { link } from "fs";

interface AddSpecializationRequest {
  specializations: Array<TrainerSpecializationCreationAttributes>;
}

interface UpdatingSpecializationRequest {
  specialization: {
    experienceLevel?: "beginner" | "intermediate" | "expert";
    certification?: string;
  };
}

export const createTrainerSpecialization = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    const { specializations } = req.body as AddSpecializationRequest;

    const trainer = await Trainer.findOne({ where: { userId: userId } });
    if (!trainer) {
      return sendError(res, 403, "Trainer doesnt exist for this user");
    }

    if (!Array.isArray(specializations) || specializations.length === 0) {
      return sendError(res, 400, "Specializztions must be a non empty array");
    }

    const specializationIds = specializations.map((s) => s.specializationId);

    const validSpecializationsIds = await Specialization.findAll({
      where: {
        id: { [Op.in]: specializationIds },
        isActive: true,
      },
    });

    if (specializationIds.length != validSpecializationsIds.length) {
      return sendError(
        res,
        400,
        "One or more specialization ids are invalid or inactive"
      );
    }

    const existingLinks = await TrainerSpecialization.findAll({
      where: {
        trainerId: trainer.id,
        specializationId: { [Op.in]: specializationIds },
      },
    });

    const existingSpecializationId = new Set(
      existingLinks.map((link) => link.specializationId)
    );

    const specializationsToAdd = specializations.filter(
      (spec) => !existingSpecializationId.has(spec.specializationId)
    );

    if (specializationsToAdd.length === 0) {
      return sendError(res, 409, "You already have all the specs");
    }

    const recordsToCreate = specializationsToAdd.map((spec) => ({
      trainerId: trainer.id,
      specializationId: spec.specializationId,
      experienceLevel: spec.experienceLevel,
      certification: spec.certification,
    }));

    const newTrainerSpecializations =
      await TrainerSpecialization.bulkCreate(recordsToCreate);

    sendSuccess(res, 201, "Specializations added succesfully");
  } catch (error: any) {
    console.error("Error adding specializations to trainer:", error);
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err: any) => ({
        field: err.path,
        message: err.message,
      }));
      return sendError(res, 400, "Validation failed", errors);
    }
    sendError(res, 500, "Failed to add specializations.");
  }
};
