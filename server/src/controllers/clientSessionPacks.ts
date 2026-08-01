import { Response } from "express";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { Trainer } from "../models/trainer";
import { User } from "../models/user";
import { ClientSessionPack } from "../models/clientSessionPack";

async function getTrainerForUser(userId: number) {
  return Trainer.findOne({ where: { userId } });
}

export const createClientPack = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can create client packs");
      return;
    }

    const { clientId, name, totalSessions } = req.body;

    const client = await User.findByPk(clientId);
    if (!client) {
      sendError(res, 404, "Client not found");
      return;
    }

    const pack = await ClientSessionPack.create({
      trainerId: trainer.id,
      clientId,
      name: name ?? null,
      totalSessions,
    });

    sendSuccess(res, 201, "Client pack created", pack.toJSON());
  } catch (error) {
    console.error("Create client pack error:", error);
    sendError(res, 500, "Failed to create client pack");
  }
};

export const getClientPacks = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can view client packs");
      return;
    }

    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    if (clientId !== undefined && !Number.isFinite(clientId)) {
      sendError(res, 400, "Invalid client id");
      return;
    }

    const packs = await ClientSessionPack.findAll({
      where: { trainerId: trainer.id, ...(clientId !== undefined && { clientId }) },
      order: [["createdAt", "ASC"]],
    });

    sendSuccess(res, 200, "Client packs retrieved", packs.map((p) => p.toJSON()));
  } catch (error) {
    console.error("Get client packs error:", error);
    sendError(res, 500, "Failed to retrieve client packs");
  }
};

export const updateClientPack = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can update client packs");
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      sendError(res, 400, "Invalid pack id");
      return;
    }

    const pack = await ClientSessionPack.findByPk(id);
    if (!pack || pack.trainerId !== trainer.id) {
      sendError(res, 404, "Pack not found");
      return;
    }

    const { name, totalSessions, usedSessions } = req.body;
    const nextTotal = totalSessions ?? pack.totalSessions;
    const nextUsed = usedSessions ?? pack.usedSessions;
    if (nextUsed > nextTotal) {
      sendError(res, 422, "Used sessions cannot exceed total sessions");
      return;
    }

    await pack.update({
      ...(name !== undefined && { name }),
      ...(totalSessions !== undefined && { totalSessions }),
      ...(usedSessions !== undefined && { usedSessions }),
    });

    sendSuccess(res, 200, "Pack updated", pack.toJSON());
  } catch (error) {
    console.error("Update client pack error:", error);
    sendError(res, 500, "Failed to update client pack");
  }
};

export const deleteClientPack = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can delete client packs");
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      sendError(res, 400, "Invalid pack id");
      return;
    }

    const pack = await ClientSessionPack.findByPk(id);
    if (!pack || pack.trainerId !== trainer.id) {
      sendError(res, 404, "Pack not found");
      return;
    }

    await pack.destroy();
    sendSuccess(res, 200, "Pack deleted");
  } catch (error) {
    console.error("Delete client pack error:", error);
    sendError(res, 500, "Failed to delete client pack");
  }
};

export const getMyPacks = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const packs = await ClientSessionPack.findAll({
      where: { clientId: req.user!.id },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Trainer,
          attributes: ["id"],
          include: [{ model: User, attributes: ["firstName", "lastName"] }],
        },
      ],
    });

    sendSuccess(res, 200, "My packs retrieved", packs.map((p) => p.toJSON()));
  } catch (error) {
    console.error("Get my packs error:", error);
    sendError(res, 500, "Failed to retrieve packs");
  }
};
