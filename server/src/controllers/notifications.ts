import { Response } from "express";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { UserPushToken } from "../models/userPushToken";

export const getNotificationSettings = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const record = await UserPushToken.findOne({ where: { userId: req.user!.id } });
    sendSuccess(res, 200, "Notification settings retrieved", {
      remindersEnabled: record?.remindersEnabled ?? false,
      hasToken: Boolean(record?.expoPushToken),
    });
  } catch (error) {
    console.error("Get notification settings error:", error);
    sendError(res, 500, "Failed to retrieve notification settings");
  }
};

export const updateNotificationSettings = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { expoPushToken, remindersEnabled, locale } = req.body;

    const [record] = await UserPushToken.findOrCreate({
      where: { userId: req.user!.id },
      defaults: { userId: req.user!.id },
    });

    await record.update({
      ...(expoPushToken !== undefined && { expoPushToken }),
      ...(remindersEnabled !== undefined && { remindersEnabled }),
      ...(locale !== undefined && { locale }),
    });

    sendSuccess(res, 200, "Notification settings updated", {
      remindersEnabled: record.remindersEnabled,
      hasToken: Boolean(record.expoPushToken),
    });
  } catch (error) {
    console.error("Update notification settings error:", error);
    sendError(res, 500, "Failed to update notification settings");
  }
};
