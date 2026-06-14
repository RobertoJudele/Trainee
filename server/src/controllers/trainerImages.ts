import { Response } from "express";
import { generateS3key } from "../config/s3";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { Trainer } from "../models/trainer";
import { TrainerImage } from "../models/trainerImage";
import { TrainerImageCategory } from "../types/trainerImage";
import { S3ImageService } from "../services/s3ImageService";
import {
  processGalleryImage,
  processCredentialImage,
  ProcessedImage,
} from "../services/imageProcessor";

// Max images a trainer may keep per category (gallery / credential).
const MAX_PER_CATEGORY = 5;

async function getTrainerForUser(userId: number) {
  return Trainer.findOne({ where: { userId } });
}

// GET /trainer-images — the authenticated trainer's own images, grouped by category.
export const getTrainerImages = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers have images");
      return;
    }

    const images = await TrainerImage.findAll({
      where: { trainerId: trainer.id },
      order: [
        ["displayOrder", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    const gallery = images
      .filter((i) => i.category === "gallery")
      .map((i) => i.toJSON());
    const credential = images
      .filter((i) => i.category === "credential")
      .map((i) => i.toJSON());

    sendSuccess(res, 200, "Trainer images retrieved", { gallery, credential });
  } catch (error) {
    console.error("Get trainer images error:", error);
    sendError(res, 500, "Failed to retrieve trainer images");
  }
};

// Shared handler for the two multi-upload categories. Enforces the per-category
// cap, resizes each file with the supplied processor, uploads to S3, and records
// a TrainerImage row.
async function handleCategoryUpload(
  category: TrainerImageCategory,
  process: (input: Buffer) => Promise<ProcessedImage>,
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can upload these images");
      return;
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      sendError(res, 400, "No files uploaded");
      return;
    }

    const existing = await TrainerImage.count({
      where: { trainerId: trainer.id, category },
    });
    if (existing + files.length > MAX_PER_CATEGORY) {
      sendError(
        res,
        422,
        `You can have at most ${MAX_PER_CATEGORY} ${category} images (you currently have ${existing}).`
      );
      return;
    }

    const created: any[] = [];
    for (const file of files) {
      const { buffer, contentType } = await process(file.buffer);
      const key = generateS3key(req, file, `trainer-${category}`, "jpg");
      const uploadResult = await S3ImageService.uploadImage(buffer, key, contentType);
      const row = await TrainerImage.create({
        trainerId: trainer.id,
        imageUrl: uploadResult.url,
        category,
        isPrimary: false,
        displayOrder: existing + created.length,
      });
      created.push(row.toJSON());
    }

    sendSuccess(res, 201, "Images uploaded successfully", { images: created });
  } catch (error) {
    console.error(`Upload ${category} images error:`, error);
    sendError(res, 500, "Failed to upload images");
  }
}

// POST /trainer-images/gallery  (field: "images", up to 5)
export const uploadGalleryImages = (
  req: AuthenticatedRequest,
  res: Response
) => handleCategoryUpload("gallery", processGalleryImage, req, res);

// POST /trainer-images/credential  (field: "images", up to 5)
export const uploadCredentialImages = (
  req: AuthenticatedRequest,
  res: Response
) => handleCategoryUpload("credential", processCredentialImage, req, res);

// DELETE /trainer-images/:id — removes one gallery/credential image (own only).
export const deleteTrainerImage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can delete these images");
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      sendError(res, 400, "Invalid image id");
      return;
    }

    const image = await TrainerImage.findByPk(id);
    if (!image || image.trainerId !== trainer.id) {
      sendError(res, 404, "Image not found");
      return;
    }

    const key = S3ImageService.extractKeyFromUrl(image.imageUrl);
    if (key) {
      try {
        await S3ImageService.deleteImage(key);
      } catch (error) {
        // Don't block the DB delete if the object is already gone from S3.
        console.warn("Failed to delete trainer image from S3:", error);
      }
    }

    await image.destroy();
    sendSuccess(res, 200, "Image deleted successfully");
  } catch (error) {
    console.error("Delete trainer image error:", error);
    sendError(res, 500, "Failed to delete image");
  }
};
