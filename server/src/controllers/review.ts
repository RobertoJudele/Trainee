import { Request, Response } from "express";
import { ReviewRequest } from "../types/review";
import { sendError, sendSuccess } from "../utils/response";
import { getSequelizeValidationErrors } from "../utils/errors";
import { Trainer } from "../models/trainer";
import { Review } from "../models/review";
import { User } from "../models/user";
import { TrainerClient } from "../models/trainerClient";

export const getReviews = async (
  req: Request<{ trainerId: string }>,
  res: Response
) => {
  try {
    const trainerId = parseInt(req.params.trainerId);
    if (isNaN(trainerId) || trainerId <= 0) {
      sendError(res, 400, "Invalid trainer ID");
      return;
    }

    const trainer = await Trainer.findByPk(trainerId);
    if (!trainer) {
      sendError(res, 404, "Trainer not found");
      return;
    }

    const reviews = await Review.findAll({
      where: { trainerId },
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    sendSuccess(res, 200, "Reviews fetched successfully", reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    sendError(res, 500, "Error fetching reviews");
  }
};

export const createReview = async (
  req: Request<{ trainerId: string }, {}, ReviewRequest>,
  res: Response
) => {
  try {
    const { rating, reviewText } = req.body;
    const trainerId = parseInt(req.params.trainerId);
    const user = req.user!;

    if (isNaN(trainerId)) {
      sendError(res, 400, "Trainer doesnt exist");
      return;
    }

    const trainer = await Trainer.findByPk(trainerId);

    if (!trainer) {
      sendError(res, 400, "Trainer doesnt exist");
      return;
    }

    // trainerId is a Trainer PK, user.id a User PK — comparing them directly never
    // matched, so trainers could review their own profile.
    if (trainer.userId === user.id) {
      sendError(res, 400, "Trainers cant review themself");
      return;
    }

    // Only clients the trainer has actually taken on can review them. This is
    // trainer-controlled, so it doesn't stop a trainer farming reviews from their own
    // throwaway accounts — it stops drive-by reviews from strangers, and every fake
    // now leaves a trainer_clients row naming both accounts.
    // ponytail: roster membership, not attended sessions — slots never reach COMPLETED
    // (checkInCodeHash is never written), so a stricter gate would block everyone.
    const isClientOfTrainer = await TrainerClient.findOne({
      where: { trainerId, clientId: user.id },
    });

    if (!isClientOfTrainer) {
      sendError(res, 403, "You can only review a trainer you have trained with");
      return;
    }

    const reviewExists = await Review.findOne({
      where: { clientId: user.id, trainerId: trainerId },
    });

    if (reviewExists) {
      sendError(res, 400, "You already left a review for this trainer");
      return;
    }

    const review = await Review.create({
      clientId: user.id,
      trainerId: trainerId,
      rating: rating,
      reviewText: reviewText,
    });

    const completeReview = await Review.findByPk(review.id, {
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "profileImageUrl"],
        },
      ],
    });

    sendSuccess(res, 201, "Complete review", completeReview);
  } catch (error: unknown) {
    console.error(error);
    const validationErrors = getSequelizeValidationErrors(error);
    if (validationErrors) {
      sendError(res, 400, "Validation failed", validationErrors);
      return;
    }
    sendError(res, 500, "Error while creating revirw");
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const reviewId = parseInt(req.params.reviewId);
    if (!userId) {
      sendError(res, 400, "No user found ");
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      sendError(res, 400, "No user found ");
      return;
    }
    const review = await Review.findByPk(reviewId);
    if (!review) {
      sendError(res, 400, "Review not found");
      return;
    }
    if (review.clientId !== userId) {
      sendError(res, 403, "This review doesnt belong to you!");
      return;
    }

    review.destroy();
    sendSuccess(res, 200, "Review deleted succesfully");
  } catch (error: unknown) {
    console.error("Error while deleting review: ", error);
    const validationErrors = getSequelizeValidationErrors(error);
    if (validationErrors) {
      sendError(res, 400, "Validation failed", validationErrors);
      return;
    }
    sendError(res, 500, "Unknown error while deleting review");
  }
};

export const updateReview = async (req: Request, res: Response) => {
  try {
    const reviewId = req.params.reviewId;
    const { rating, reviewText } = req.body;
    const userId = req.user.id;
    if (!userId) {
      sendError(res, 400, "User id not found ");
      return;
    }
    const user = User.findByPk(userId);

    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }

    if (!reviewId) {
      sendError(res, 404, "Review id not found");
      return;
    }

    const review = await Review.findByPk(reviewId);
    if (!review) {
      sendError(res, 404, "Review not found ");
      return;
    }

    if (review.clientId != userId) {
      sendError(res, 400, "This review isnt yours");
      return;
    }

    await review.update({
      rating: rating || review.rating,
      reviewText: reviewText || review.reviewText,
    });

    sendSuccess(res, 200, "Review updateds succesfully");
  } catch (error: unknown) {
    console.error("Error while updating review: ", error);
    const validationErrors = getSequelizeValidationErrors(error);
    if (validationErrors) {
      sendError(res, 400, "Validation failed", validationErrors);
      return;
    }
    sendError(res, 500, "Unknown error while updating review");
  }
};
