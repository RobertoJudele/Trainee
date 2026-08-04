import { AuthenticatedRequest } from "../types/common";
import { NextFunction, Response } from "express";
import { sendError } from "../utils/response";
import { billingService, BillingError } from "../services/billing";

export const subscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 401, "Not authenticated");
      return;
    }

    const entitlement = await billingService.getEntitlement(userId);
    if (!entitlement.isActive) {
      const detailSuffix = ` (source=${entitlement.source}, status=${entitlement.status})`;
      sendError(
        res,
        402,
        `${entitlement.reason || "Payment unsuccessful or canceled"}${detailSuffix}`,
      );
      return;
    }
    next();
  } catch (error) {
    if (error instanceof BillingError && error.code === "NOT_TRAINER") {
      // 403, not 400: the request is well-formed, the caller just is not a
      // trainer. The controllers behind this middleware already answered 403 for
      // that, and now that it guards them it must not weaken the status.
      sendError(res, 403, "Trainer profile not found");
      return;
    }
    console.error("Subscription middleware error:", error);
    sendError(res, 500, "Could not verify subscription status");
  }
};
