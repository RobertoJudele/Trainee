/**
 * Sends a push to a user's registered device and reports what Expo actually did
 * with it.
 *
 *   npm run push:test -- <userId>
 *   npm run push:test -- --token ExponentPushToken[xxxx]
 *
 * Unlike reminders:check this has no business preconditions — no slot, no
 * schedule, no time window. It answers one question: does a notification reach
 * this phone at all?
 *
 * The important part is the second step. Expo's send call returns a *ticket*,
 * which says only that the message was queued. Delivery failures — an
 * unregistered device, or FCM credentials that don't match the app — surface
 * later, in the *receipt*. A send that "succeeds" and never arrives is the
 * normal symptom of a push setup problem, so this waits and fetches the receipt.
 */
import "reflect-metadata";
import dotenv from "dotenv";
import sequelize from "../db";
import { UserPushToken } from "../models/userPushToken";

dotenv.config();

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPT_URL = "https://exp.host/--/api/v2/push/getReceipts";
const RECEIPT_DELAY_MS = 6000;

/** What the common Expo receipt errors actually mean, in practice. */
const EXPLAIN: Record<string, string> = {
  DeviceNotRegistered:
    "Tokenul nu mai e valid — aplicația a fost dezinstalată, reinstalată sau tokenul s-a schimbat. Redeschide aplicația ca să se reînregistreze.",
  MismatchSenderId:
    "Credențialele FCM nu se potrivesc cu aplicația. Asta apare când google-services.json lipsește ori e din alt proiect Firebase decât cheia încărcată în EAS.",
  InvalidCredentials:
    "Expo nu are credențiale valide ca să trimită în numele tău. Încarcă cheia de serviciu FCM V1 prin `eas credentials`.",
  MessageTooBig: "Mesajul depășește limita Expo.",
  MessageRateExceeded: "Prea multe mesaje către acest dispozitiv, prea repede.",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const tokenFlagIndex = args.indexOf("--token");
  const explicitToken = tokenFlagIndex >= 0 ? args[tokenFlagIndex + 1] : undefined;
  const userId = Number(args.find((a) => /^\d+$/.test(a)));

  let token = explicitToken;

  if (!token) {
    if (!Number.isFinite(userId)) {
      console.error("Usage: npm run push:test -- <userId>   |   -- --token ExponentPushToken[...]");
      process.exit(1);
    }
    (sequelize as unknown as { options: { logging: boolean } }).options.logging = false;
    await sequelize.authenticate({ logging: false });

    const row = await UserPushToken.findOne({ where: { userId } });
    if (!row?.expoPushToken) {
      console.error(
        `\nUtilizatorul ${userId} nu are token înregistrat.\n` +
          `Deschide aplicația cu acest cont și activează memento-urile din "Programul meu".\n`
      );
      await sequelize.close();
      process.exit(1);
    }
    token = row.expoPushToken;
    console.log(`\nUtilizator ${userId} · memento-uri: ${row.remindersEnabled ? "active" : "INACTIVE"}`);
  }

  console.log(`Token: ${token.slice(0, 30)}…\n`);

  // Step 1 — queue the message.
  const sendRes = await fetch(SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        to: token,
        title: "Salvio — test",
        body: `Notificare de test, ${new Date().toLocaleTimeString("ro-RO")}`,
        sound: "default",
      },
    ]),
  });

  const sendBody = (await sendRes.json()) as {
    data?: { status: string; id?: string; message?: string; details?: { error?: string } }[];
    errors?: unknown;
  };

  console.log(`1. Trimitere — HTTP ${sendRes.status}`);
  console.log(JSON.stringify(sendBody, null, 2));

  const ticket = sendBody.data?.[0];
  if (!ticket || ticket.status !== "ok" || !ticket.id) {
    const err = ticket?.details?.error;
    console.log(`\n✗ Expo a respins mesajul imediat.`);
    if (err && EXPLAIN[err]) console.log(`  ${err}: ${EXPLAIN[err]}`);
    await closeIfOpen();
    return;
  }

  // Step 2 — the receipt, where real delivery failures show up.
  console.log(`\n2. Aștept confirmarea de livrare (${RECEIPT_DELAY_MS / 1000}s)…`);
  await sleep(RECEIPT_DELAY_MS);

  const receiptRes = await fetch(RECEIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [ticket.id] }),
  });
  const receiptBody = (await receiptRes.json()) as {
    data?: Record<string, { status: string; message?: string; details?: { error?: string } }>;
  };

  console.log(JSON.stringify(receiptBody, null, 2));

  const receipt = receiptBody.data?.[ticket.id];
  if (!receipt) {
    console.log("\n? Confirmarea nu e gata încă. Reia peste un minut cu acelasi ticket id.");
  } else if (receipt.status === "ok") {
    console.log("\n✓ Expo a livrat mesajul către serviciul de push al platformei.");
    console.log("  Dacă tot nu apare pe telefon: notificările sunt oprite din setările sistemului,");
    console.log("  aplicația e pe Expo Go (care nu primește push pe Android din SDK 53),");
    console.log("  sau telefonul e în modul economie de energie.");
  } else {
    const err = receipt.details?.error;
    console.log(`\n✗ Livrare eșuată: ${receipt.message ?? receipt.status}`);
    if (err && EXPLAIN[err]) console.log(`  ${err}: ${EXPLAIN[err]}`);
  }

  await closeIfOpen();
}

async function closeIfOpen() {
  try {
    await sequelize.close();
  } catch {
    // Not opened when --token was used.
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
