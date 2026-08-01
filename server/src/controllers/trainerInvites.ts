import crypto from "crypto";
import { Response } from "express";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { Trainer } from "../models/trainer";
import { User } from "../models/user";
import { TrainerInviteCode } from "../models/trainerInviteCode";
import { TrainerClient } from "../models/trainerClient";

// No easily-confused characters (I/L/O/0/1).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

async function getTrainerForUser(userId: number) {
  return Trainer.findOne({ where: { userId } });
}

export const getMyInviteCode = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers have an invite code");
      return;
    }

    let invite = await TrainerInviteCode.findOne({ where: { trainerId: trainer.id } });
    if (!invite) {
      // Retry a couple of times in the (astronomically unlikely) event of a code collision.
      for (let attempt = 0; attempt < 3 && !invite; attempt += 1) {
        try {
          invite = await TrainerInviteCode.create({ trainerId: trainer.id, code: generateCode() });
        } catch (createError) {
          if (attempt === 2) throw createError;
        }
      }
    }

    sendSuccess(res, 200, "Invite code retrieved", { code: invite!.code });
  } catch (error) {
    console.error("Get invite code error:", error);
    sendError(res, 500, "Failed to retrieve invite code");
  }
};

export const redeemInvite = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== "client") {
      sendError(res, 403, "Only clients can redeem a trainer invite");
      return;
    }

    const code = String(req.body.code ?? "").trim().toUpperCase();
    const invite = await TrainerInviteCode.findOne({ where: { code } });
    if (!invite) {
      sendError(res, 404, "Invite code not found");
      return;
    }

    const trainer = await Trainer.findByPk(invite.trainerId, {
      include: [{ model: User, attributes: ["firstName", "lastName"] }],
    });
    if (!trainer) {
      sendError(res, 404, "Trainer not found");
      return;
    }

    const [, created] = await TrainerClient.findOrCreate({
      where: { trainerId: trainer.id, clientId: user.id },
      defaults: { trainerId: trainer.id, clientId: user.id },
    });

    sendSuccess(res, 200, created ? "Connected to trainer" : "Already connected", {
      trainerId: trainer.id,
      firstName: trainer.user?.firstName ?? "",
      lastName: trainer.user?.lastName ?? "",
      alreadyConnected: !created,
    });
  } catch (error) {
    console.error("Redeem invite error:", error);
    sendError(res, 500, "Failed to redeem invite code");
  }
};

export const getMyTrainers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const connections = await TrainerClient.findAll({
      where: { clientId: req.user!.id },
      include: [
        {
          model: Trainer,
          attributes: ["id"],
          include: [{ model: User, attributes: ["firstName", "lastName"] }],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    const trainers = connections
      .filter((c) => c.trainer)
      .map((c) => ({
        trainerId: c.trainer.id,
        firstName: c.trainer.user?.firstName ?? "",
        lastName: c.trainer.user?.lastName ?? "",
      }));

    sendSuccess(res, 200, "My trainers retrieved", trainers);
  } catch (error) {
    console.error("Get my trainers error:", error);
    sendError(res, 500, "Failed to retrieve trainers");
  }
};

export const getMyConnectedClients = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can list connected clients");
      return;
    }

    const connections = await TrainerClient.findAll({
      where: { trainerId: trainer.id },
      include: [{ model: User, attributes: ["id", "email", "firstName", "lastName"] }],
      order: [["createdAt", "ASC"]],
    });

    const clients = connections
      .filter((c) => c.client)
      .map((c) => ({
        id: c.client.id,
        email: c.client.email,
        firstName: c.client.firstName,
        lastName: c.client.lastName,
      }));

    sendSuccess(res, 200, "Connected clients retrieved", clients);
  } catch (error) {
    console.error("Get connected clients error:", error);
    sendError(res, 500, "Failed to retrieve connected clients");
  }
};
