import { Response } from "express";
import { generateS3key } from "../config/s3";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { Trainer } from "../models/trainer";
import {
  TrainerTransformation,
  TRANSFORMATION_DESCRIPTION_MAX,
} from "../models/trainerTransformation";
import { S3ImageService } from "../services/s3ImageService";
import { processGalleryImage } from "../services/imageProcessor";

// Max client transformations a trainer may show on their profile.
export const MAX_TRANSFORMATIONS = 5;

async function getTrainerForUser(userId: number) {
  return Trainer.findOne({ where: { userId } });
}

// GET /trainer-transformations — the authenticated trainer's own transformations.
export const getTrainerTransformations = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers have transformations");
      return;
    }

    const transformations = await TrainerTransformation.findAll({
      where: { trainerId: trainer.id },
      order: [
        ["displayOrder", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    sendSuccess(
      res,
      200,
      "Trainer transformations retrieved",
      transformations.map((t) => t.toJSON())
    );
  } catch (error) {
    console.error("Get trainer transformations error:", error);
    sendError(res, 500, "Failed to retrieve transformations");
  }
};

// POST /trainer-transformations  (multipart: "before" + "after" files, "description",
// "consent" = "true"). The trainer confirms they have the client's permission; the
// client is not asked in-app.
export const createTrainerTransformation = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can add transformations");
      return;
    }

    const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const before = files.before?.[0];
    const after = files.after?.[0];
    if (!before || !after) {
      sendError(res, 400, "Both a before and an after photo are required");
      return;
    }

    const description =
      typeof req.body.description === "string" ? req.body.description.trim() : "";
    if (!description || description.length > TRANSFORMATION_DESCRIPTION_MAX) {
      sendError(
        res,
        400,
        `Description must be 1-${TRANSFORMATION_DESCRIPTION_MAX} characters`
      );
      return;
    }

    if (req.body.consent !== "true") {
      sendError(res, 400, "Confirm the client agreed to publish these photos");
      return;
    }

    const existing = await TrainerTransformation.count({
      where: { trainerId: trainer.id },
    });
    if (existing >= MAX_TRANSFORMATIONS) {
      sendError(
        res,
        422,
        `You can have at most ${MAX_TRANSFORMATIONS} transformations.`
      );
      return;
    }

    const upload = async (file: Express.Multer.File) => {
      const { buffer, contentType } = await processGalleryImage(
        file.buffer,
        file.mimetype
      );
      const key = generateS3key(req, file, "trainer-transformation", "jpg");
      return (await S3ImageService.uploadImage(buffer, key, contentType)).url;
    };

    // Both photos or neither: if one upload fails, drop the one that made it so
    // storage doesn't keep an orphan.
    const [beforeResult, afterResult] = await Promise.allSettled([
      upload(before),
      upload(after),
    ]);
    if (beforeResult.status === "rejected" || afterResult.status === "rejected") {
      const failed = [beforeResult, afterResult].find(
        (r): r is PromiseRejectedResult => r.status === "rejected"
      );
      console.error("Upload transformation photo failed:", failed?.reason);
      await S3ImageService.deleteImagesByUrl([
        beforeResult.status === "fulfilled" ? beforeResult.value : null,
        afterResult.status === "fulfilled" ? afterResult.value : null,
      ]);
      sendError(res, 422, "Could not process one of the photos");
      return;
    }

    const row = await TrainerTransformation.create({
      trainerId: trainer.id,
      beforeImageUrl: beforeResult.value,
      afterImageUrl: afterResult.value,
      description,
      displayOrder: existing,
    });

    sendSuccess(res, 201, "Transformation added", row.toJSON());
  } catch (error) {
    console.error("Create trainer transformation error:", error);
    sendError(res, 500, "Failed to add transformation");
  }
};

// DELETE /trainer-transformations/:id — removes one transformation (own only).
export const deleteTrainerTransformation = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can delete transformations");
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      sendError(res, 400, "Invalid transformation id");
      return;
    }

    const transformation = await TrainerTransformation.findByPk(id);
    if (!transformation || transformation.trainerId !== trainer.id) {
      sendError(res, 404, "Transformation not found");
      return;
    }

    const urls = [transformation.beforeImageUrl, transformation.afterImageUrl];
    await transformation.destroy();
    // Best-effort and never throws, so a missing object doesn't block the delete.
    await S3ImageService.deleteImagesByUrl(urls);
    sendSuccess(res, 200, "Transformation deleted successfully");
  } catch (error) {
    console.error("Delete trainer transformation error:", error);
    sendError(res, 500, "Failed to delete transformation");
  }
};
