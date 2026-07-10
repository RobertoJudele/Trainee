import { Op } from "sequelize";
import { TrainerScheduleSlot } from "../models/trainerScheduleSlot";
import { SlotReminder } from "../models/slotReminder";
import { UserPushToken } from "../models/userPushToken";
import { Trainer } from "../models/trainer";
import { User } from "../models/user";
import { SlotStatus } from "../types/schedule";
import { addDaysToKey, utcInstantToDateKey, zonedDayBoundsUtc } from "../utils/scheduleTime";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_CHUNK = 100;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly
// Reminders go out at 19:00 Bucharest time for all of tomorrow's sessions.
// The sweep still runs hourly: sweeps before 19:00 do nothing, and the
// 20:00-23:00 sweeps act as catch-up (dedup table prevents doubles) if the
// server was down at 19:00.
const REMINDER_TIME_ZONE = "Europe/Bucharest";
const REMINDER_HOUR = 19;

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
    const now = new Date();
    const localHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: REMINDER_TIME_ZONE,
      }).format(now)
    );
    if (localHour < REMINDER_HOUR) return;

    const todayKey = utcInstantToDateKey(now, REMINDER_TIME_ZONE);
    const tomorrow = zonedDayBoundsUtc(addDaysToKey(todayKey, 1), REMINDER_TIME_ZONE);

    const found = await TrainerScheduleSlot.findAll({
      where: {
        status: SlotStatus.ASSIGNED,
        startsAt: {
          [Op.gte]: tomorrow.start,
          [Op.lte]: tomorrow.end,
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
