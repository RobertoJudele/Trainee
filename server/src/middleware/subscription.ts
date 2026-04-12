import { AuthenticatedRequest } from "../types/common";
import { NextFunction, Response } from "express";
import { Trainer } from "../models/trainer";
import { resolveTrainerEntitlement } from "../services/entitlement";
import { sendError } from "../utils/response";

export const subscription = async(req: AuthenticatedRequest, res:Response , next:NextFunction) : Promise<void>=>{
    try {
        const user=req.user;
        const userId=user?.id;
        const trainer = await Trainer.findOne({where: {userId}})
        if (!trainer){
            sendError(res,400,"Trainer profile not found");
            return;
        }
        const entitlement = resolveTrainerEntitlement(trainer);
        if (!entitlement.isActive) {
            const detailSuffix = ` (source=${entitlement.source}, status=${entitlement.status})`;
            sendError(
                res,
                402,
                `${entitlement.reason || "Payment unsuccessful or canceled"}${detailSuffix}`
            )
            return
        }
        next()
    } catch (error) {
        console.error("Subscription middleware error:", error);
        sendError(res, 500, "Could not verify subscription status");   
    }


}