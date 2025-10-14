import { Response, Request } from "express";
import { Specialization } from "../models/specialization";
import { SpecializationCreationAttributes } from "../types/specialization";
import { sendSuccess } from "../utils/response";

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
