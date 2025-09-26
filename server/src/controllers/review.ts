import { Request, Response } from "express";
import { ReviewRequest } from "../types/review";
import { sendError, sendSuccess } from "../utils/response";
import { Trainer } from "../models/trainer";
import { Review } from "../models/review";
import { User } from "../models/user";


export const createReview = async (
  req: Request<{ trainerId: string }, {}, ReviewRequest>,
  res: Response
) => {
  try {
    const { rating, reviewText } = req.body;
    const trainerId = parseInt(req.params.trainerId);
    const user = req.user!;

    console.log("Trainer and user ", user.id, trainerId);

    if (isNaN(trainerId)) {
      console.log(trainerId);
      sendError(res, 400, "Trainer doesnt exist");
      return;
    }

    const trainer = await Trainer.findByPk(trainerId);

    if (!trainer) {
      sendError(res, 400, "Trainer doesnt exist");
      return;
    }

    if (trainerId == user.id) {
      sendError(res, 400, "Trainers cant review themself");
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
  } catch (error: any) {
    console.error(error);
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err: any) => ({
        field: err.path,
        message: err.message,
      }));
      sendError(res, 400, "Validation failed");
      return;
    }
    sendError(res, 500, "Error while creating revirw");
  }
};

