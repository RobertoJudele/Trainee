import { Response, Request } from "express";
import { Specialization } from "../models/specialization";
import { SpecializationCreationAttributes } from "../types/specialization";
import { sendError, sendSuccess } from "../utils/response";

export const getSpecializations = async (req: Request, res: Response) => {
  try {
    const specializations = await Specialization.findAll({
      where: { isActive: true },
      attributes: ["id", "name", "description", "iconUrl", "isActive"],
      order: [["name", "ASC"]],
    });

    sendSuccess(res, 200, "Specializations retrieved successfully", specializations);
  } catch (error: unknown) {
    console.error("Error retrieving specializations", error);
    sendError(res, 500, "Could not retrieve specializations");
  }
};

export const createSpecialization = async (
  req: Request<{}, {}, SpecializationCreationAttributes>,
  res: Response
) => {
  const { name, description, iconUrl, isActive } = req.body;
  const specialization = await Specialization.create({
    name: name,
    description: description,
    iconUrl: iconUrl,
    isActive: isActive,
  });
  sendSuccess(res, 201, "Specialization created succesfully", specialization);
};
