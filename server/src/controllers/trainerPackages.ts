import { Response } from "express";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { Trainer } from "../models/trainer";
import { TrainerPackage } from "../models/trainerPackage";

const MAX_PACKAGES = 5;

async function getTrainerForUser(userId: number) {
  return Trainer.findOne({ where: { userId } });
}

async function recalculateSessionRate(trainerId: number): Promise<void> {
  const packages = await TrainerPackage.findAll({ where: { trainerId } });
  const trainer = await Trainer.findByPk(trainerId);
  if (!trainer) return;

  if (packages.length === 0) {
    trainer.setDataValue("sessionRate", null as any);
    await trainer.save();
    return;
  }

  const lowestPerSession = Math.min(
    ...packages.map((p) => Number(p.price) / p.sessionCount)
  );
  await trainer.update({
    sessionRate: Math.round(lowestPerSession * 100) / 100,
  });
}

export const getTrainerPackages = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainerId = Number(req.params.trainerId);
    if (!Number.isFinite(trainerId)) {
      sendError(res, 400, "Invalid trainer id");
      return;
    }

    const packages = await TrainerPackage.findAll({
      where: { trainerId },
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    sendSuccess(res, 200, "Trainer packages retrieved", packages.map((p) => p.toJSON()));
  } catch (error) {
    console.error("Get trainer packages error:", error);
    sendError(res, 500, "Failed to retrieve trainer packages");
  }
};

export const createTrainerPackage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can create packages");
      return;
    }

    const existing = await TrainerPackage.count({ where: { trainerId: trainer.id } });
    if (existing >= MAX_PACKAGES) {
      sendError(res, 422, `You can have at most ${MAX_PACKAGES} packages.`);
      return;
    }

    const { name, price, sessionCount, sortOrder } = req.body;

    const pkg = await TrainerPackage.create({
      trainerId: trainer.id,
      name,
      price,
      sessionCount,
      sortOrder: sortOrder ?? existing,
    });

    await recalculateSessionRate(trainer.id);

    sendSuccess(res, 201, "Package created", pkg.toJSON());
  } catch (error) {
    console.error("Create trainer package error:", error);
    sendError(res, 500, "Failed to create package");
  }
};

export const updateTrainerPackage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can update packages");
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      sendError(res, 400, "Invalid package id");
      return;
    }

    const pkg = await TrainerPackage.findByPk(id);
    if (!pkg || pkg.trainerId !== trainer.id) {
      sendError(res, 404, "Package not found");
      return;
    }

    const { name, price, sessionCount, sortOrder } = req.body;
    await pkg.update({
      ...(name !== undefined && { name }),
      ...(price !== undefined && { price }),
      ...(sessionCount !== undefined && { sessionCount }),
      ...(sortOrder !== undefined && { sortOrder }),
    });

    await recalculateSessionRate(trainer.id);

    sendSuccess(res, 200, "Package updated", pkg.toJSON());
  } catch (error) {
    console.error("Update trainer package error:", error);
    sendError(res, 500, "Failed to update package");
  }
};

export const deleteTrainerPackage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can delete packages");
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      sendError(res, 400, "Invalid package id");
      return;
    }

    const pkg = await TrainerPackage.findByPk(id);
    if (!pkg || pkg.trainerId !== trainer.id) {
      sendError(res, 404, "Package not found");
      return;
    }

    await pkg.destroy();
    await recalculateSessionRate(trainer.id);

    sendSuccess(res, 200, "Package deleted");
  } catch (error) {
    console.error("Delete trainer package error:", error);
    sendError(res, 500, "Failed to delete package");
  }
};
