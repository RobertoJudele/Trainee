import { AuthenticatedRequest } from "src/types/common";
import { NextFunction, Response } from "express";
import { Trainer } from "src/models/trainer";
import { subStatus } from "src/types/trainer";
import { sendError } from "src/utils/response";

export const subscription = async(req: AuthenticatedRequest, res:Response , next:NextFunction) : Promise<void>=>{
    try {
        const user=req.user;
        const userId=user?.id;
        const trainer = await Trainer.findOne({where: {userId}})
        if (!trainer){
            sendError(res,400,"Trainer profile not found");
            return;
        }
        const subscriptionStatus=trainer.subscriptionStatus;
        if (subscriptionStatus===subStatus.TRIAL){
            const trialEndsAt=trainer.trialEndsAt
            const date=new Date();
            if (trialEndsAt<date){
                // Or redirected to payment 
                sendError(res,402, "Free trial ended")
                return
            }
        }
        if (subscriptionStatus===subStatus.CANCELED || subscriptionStatus===subStatus.PAST){

            sendError(res,402, "Payment unsuccesful or canceled")
            return
        }
        next()
    } catch (error) {
        console.error("Subscription middleware error:", error);
        sendError(res, 500, "Could not verify subscription status");   
    }


}