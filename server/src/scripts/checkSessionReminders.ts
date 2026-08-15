/**
 * Diagnoses why a client is (or isn't) getting a session reminder, and can send
 * one on the spot.
 *
 * The sweep only fires at 19:00 Europe/Bucharest for the *next* day's sessions,
 * and five separate conditions must all hold. Waiting until 19:00 to find out
 * which one failed is a poor way to spend an evening, so this reports each one.
 *
 *   npm run reminders:check -- <userId>          diagnose only
 *   npm run reminders:check -- <userId> --send   diagnose, then push immediately
 *
 * --send bypasses only the clock. Everything else — assigned slot tomorrow, a
 * registered token, reminders enabled — is real, so a delivered notification
 * means the real sweep would deliver too.
 */
import "reflect-metadata";
import dotenv from "dotenv";
import { Op } from "sequelize";
import sequelize from "../db";
import { TrainerScheduleSlot } from "../models/trainerScheduleSlot";
import { SlotReminder } from "../models/slotReminder";
import { UserPushToken } from "../models/userPushToken";
import { Trainer } from "../models/trainer";
import { User } from "../models/user";
import { SlotStatus } from "../types/schedule";
import { addDaysToKey, utcInstantToDateKey, zonedDayBoundsUtc } from "../utils/scheduleTime";

dotenv.config();

const TZ = "Europe/Bucharest";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const ok = (s: string) => `  ✓ ${s}`;
const bad = (s: string) => `  ✗ ${s}`;

async function main() {
  const args = process.argv.slice(2);
  const userId = Number(args.find((a) => /^\d+$/.test(a)));
  const send = args.includes("--send");

  if (!Number.isFinite(userId)) {
    console.error("Usage: npm run reminders:check -- <userId> [--send]");
    process.exit(1);
  }

  // The point of this script is a readable verdict; the app's SQL logging buries
  // it under a hundred lines of generated selects.
  (sequelize as unknown as { options: { logging: boolean } }).options.logging = false;
  await sequelize.authenticate({ logging: false });

  const now = new Date();
  const localHour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }).format(now)
  );
  const todayKey = utcInstantToDateKey(now, TZ);
  const tomorrowKey = addDaysToKey(todayKey, 1);
  const tomorrow = zonedDayBoundsUtc(tomorrowKey, TZ);

  console.log(`\nUser ${userId} — ora ${localHour}:00 în ${TZ}, mâine = ${tomorrowKey}\n`);

  // 1 — the clock
  console.log("1. Fereastra de trimitere (19:00)");
  console.log(localHour >= 19 ? ok("suntem după 19:00") : bad(`încă nu — sweep-ul real nu ar trimite acum`));

  // 2 — the user's push registration
  console.log("\n2. Înregistrarea pentru notificări");
  const token = await UserPushToken.findOne({ where: { userId } });
  if (!token) {
    console.log(bad("nu există rând în user_push_tokens — aplicația nu a înregistrat niciun token"));
  } else {
    console.log(token.expoPushToken ? ok(`token: ${token.expoPushToken.slice(0, 24)}…`) : bad("token gol"));
    console.log(token.remindersEnabled ? ok("memento-uri activate") : bad("memento-uri dezactivate din My Schedule"));
    console.log(ok(`limbă: ${token.locale}`));
  }

  // 3 — tomorrow's assigned slots
  console.log("\n3. Ședințe alocate mâine");
  const slots = await TrainerScheduleSlot.findAll({
    where: {
      clientId: userId,
      status: SlotStatus.ASSIGNED,
      startsAt: { [Op.gte]: tomorrow.start, [Op.lte]: tomorrow.end },
    },
    include: [{ model: Trainer, include: [{ model: User, attributes: ["firstName", "lastName"] }] }],
  });

  if (slots.length === 0) {
    console.log(bad("niciuna — sweep-ul nu are ce anunța"));
    const anyAssigned = await TrainerScheduleSlot.count({ where: { clientId: userId, status: SlotStatus.ASSIGNED } });
    console.log(`     (utilizatorul are ${anyAssigned} ședințe alocate în total, dar nu mâine)`);
  } else {
    for (const s of slots) {
      console.log(ok(`slot ${s.id} la ${s.startsAt.toISOString()}`));
    }
  }

  // 4 — dedup
  console.log("\n4. Memento deja trimis");
  const already = await SlotReminder.findAll({ where: { slotId: { [Op.in]: slots.map((s) => s.id) } } });
  const sentIds = new Set(already.map((r) => r.slotId));
  const pending = slots.filter((s) => !sentIds.has(s.id));
  console.log(
    sentIds.size === 0
      ? ok("niciun memento trimis pentru aceste ședințe")
      : bad(`${sentIds.size} deja trimise — nu se retrimit (șterge din slot_reminders ca să retestezi)`)
  );

  const wouldSend = Boolean(token?.expoPushToken) && token?.remindersEnabled === true && pending.length > 0;
  console.log(`\n→ Sweep-ul de la 19:00 ${wouldSend ? "AR trimite" : "NU ar trimite"} pentru acest utilizator.\n`);

  if (send) {
    if (!wouldSend) {
      console.log("--send ignorat: condițiile de mai sus nu sunt îndeplinite.\n");
    } else {
      const slot = pending[0];
      const trainerName = slot.trainer?.user
        ? `${slot.trainer.user.firstName} ${slot.trainer.user.lastName}`.trim()
        : "";
      const time = new Intl.DateTimeFormat(token!.locale === "ro" ? "ro-RO" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: TZ,
      }).format(slot.startsAt);
      const body =
        token!.locale === "ro" ? `Mâine la ${time} cu ${trainerName}` : `Tomorrow at ${time} with ${trainerName}`;

      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            to: token!.expoPushToken,
            title: token!.locale === "ro" ? "Memento ședință" : "Session reminder",
            body,
            sound: "default",
          },
        ]),
      });
      // Expo answers 200 with per-message tickets; a DeviceNotRegistered ticket
      // is the usual reason a "successful" send never arrives.
      console.log(`Expo a răspuns ${res.status}:`);
      console.log(JSON.stringify(await res.json(), null, 2));
      console.log("\nNu s-a scris nimic în slot_reminders, deci sweep-ul real va trimite normal.\n");
    }
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
