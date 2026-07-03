import { Op } from "sequelize";
import { TrainerScheduleSlot } from "../models/trainerScheduleSlot";
import { SlotReminder } from "../models/slotReminder";
import { UserPushToken } from "../models/userPushToken";
import { Trainer } from "../models/trainer";
import { User } from "../models/user";
import { SlotStatus } from "../types/schedule";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_CHUNK = 100;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly
// Slots starting 20-28h from now — "tomorrow" for an hourly sweep, with
// enough overlap that a missed run doesn't skip anyone.
const WINDOW_START_MS = 20 * 60 * 60 * 1000;
const WINDOW_END_MS = 28 * 60 * 60 * 1000;

const MESSAGES: Record<string, { title: string; body: (time: string, trainer: string) => string }> = {
  en: {
    title: "Session reminder",
    body: (time, trainer) => `Tomorrow at ${time} with ${trainer}`,
  },
  ro: {
    title: "Memento ședință",
    body: (time, trainer) => `Mâine la ${time} cu ${trainer}`,
  },
};

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
}

async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  for (let i = 0; i < messages.length; i += EXPO_PUSH_CHUNK) {
    const chunk = messages.slice(i, i + EXPO_PUSH_CHUNK);
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    if (!response.ok) {
      console.error("Expo push request failed:", response.status, await response.text());
    }
  }
}

const formatSlotTime = (startsAt: Date, locale: string): string =>
  new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  }).format(startsAt);

export async function runSessionReminderSweep(): Promise<void> {
  try {
    const now = Date.now();
    const found = await TrainerScheduleSlot.findAll({
      where: {
        status: SlotStatus.ASSIGNED,
        startsAt: {
          [Op.gte]: new Date(now + WINDOW_START_MS),
          [Op.lt]: new Date(now + WINDOW_END_MS),
        },
      },
      include: [
        {
          model: Trainer,
          attributes: ["id"],
          include: [{ model: User, attributes: ["firstName", "lastName"] }],
        },
      ],
    });
    const slots = found.filter((s) => s.clientId != null);
    if (slots.length === 0) return;

    const alreadySent = await SlotReminder.findAll({
      where: { slotId: { [Op.in]: slots.map((s) => s.id) } },
      attributes: ["slotId"],
    });
    const sentIds = new Set(alreadySent.map((r) => r.slotId));
    const pending = slots.filter((s) => !sentIds.has(s.id));
    if (pending.length === 0) return;

    const tokens = await UserPushToken.findAll({
      where: {
        userId: { [Op.in]: pending.map((s) => s.clientId!) },
        remindersEnabled: true,
        expoPushToken: { [Op.ne]: null },
      },
    });
    const tokenByUser = new Map(tokens.map((t) => [t.userId, t]));

    const messages: ExpoPushMessage[] = [];
    const remindedSlotIds: number[] = [];
    for (const slot of pending) {
      const token = tokenByUser.get(slot.clientId!);
      if (!token?.expoPushToken) continue;

      const locale = MESSAGES[token.locale] ? token.locale : "en";
      const trainerName = slot.trainer?.user
        ? `${slot.trainer.user.firstName} ${slot.trainer.user.lastName}`.trim()
        : "";
      messages.push({
        to: token.expoPushToken,
        title: MESSAGES[locale].title,
        body: MESSAGES[locale].body(formatSlotTime(slot.startsAt, locale), trainerName),
        sound: "default",
      });
      remindedSlotIds.push(slot.id);
    }
    if (messages.length === 0) return;

    await sendExpoPushMessages(messages);
    await SlotReminder.bulkCreate(
      remindedSlotIds.map((slotId) => ({ slotId })),
      { ignoreDuplicates: true }
    );
    console.log(`Session reminders sent: ${messages.length}`);
  } catch (error) {
    console.error("Session reminder sweep failed:", error);
  }
}

// ponytail: in-process hourly timer, assumes a single server instance;
// switch to a proper job queue / distributed lock when there's more than one.
export function startSessionReminderScheduler(): void {
  runSessionReminderSweep();
  setInterval(runSessionReminderSweep, SWEEP_INTERVAL_MS);
}
