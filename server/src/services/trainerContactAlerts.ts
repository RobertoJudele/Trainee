import { QueryTypes } from "sequelize";
import sequelize from "../db";
import { Trainer } from "../models/trainer";
import { User } from "../models/user";
import {
  TrainerContactChannel,
  TrainerContactEvent,
} from "../models/trainerContactEvent";
import { emailService } from "./emailService";
import { resolveEntitlement } from "./billing/domain";
import { toBillingState } from "./billing/trainerBillingState";
import { SystemClock } from "./billing/adapters/SystemClock";
import { isRevenueCatOnlyMode } from "../config/billingMode";
import { trainerPublicUrl } from "../utils/publicUrl";

/**
 * Taps on a trainer's WhatsApp / Instagram / Facebook buttons in the app. Once
 * CONTACT_ALERT_THRESHOLD different people have tapped, the Salvio team gets a
 * single email so they can turn the trainer into a paying subscriber.
 */

export const CONTACT_ALERT_THRESHOLD = 5;

const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX_TAPS = 10;
/** Bounds memory if a script cycles through many people or trainers. */
const MAX_TRACKED_KEYS = 10_000;

const tapBuckets = new Map<string, number[]>();

/** Keeps one person hammering a button from filling the table. */
const isRateLimited = (key: string): boolean => {
  const now = Date.now();
  if (tapBuckets.size > MAX_TRACKED_KEYS) tapBuckets.clear();

  const recent = (tapBuckets.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_TAPS) {
    tapBuckets.set(key, recent);
    return true;
  }
  recent.push(now);
  tapBuckets.set(key, recent);
  return false;
};

/** Test seam — the buckets are module-level state. */
export const resetTrainerContactRateLimit = (): void => {
  tapBuckets.clear();
};

const billingClock = new SystemClock();

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

/** One line on where the trainer stands with billing, for the alert email. */
export const describeSubscription = (trainer: Trainer): string => {
  const entitlement = resolveEntitlement(toBillingState(trainer), {
    isRevenueCatOnly: isRevenueCatOnlyMode(),
    clock: billingClock,
  });
  const until = entitlement.expiresAt ? ` până pe ${formatDate(entitlement.expiresAt)}` : "";

  if (!entitlement.isActive) {
    return `Inactiv (${entitlement.reason ?? entitlement.status})`;
  }
  if (entitlement.isPromotional) return `Gratuit, ofertă promoțională${until}`;
  if (entitlement.status === "trial") return `Trial${until}`;
  return `Plătit prin ${entitlement.source}${until}`;
};

/** Distinct people: a logged-in user by id, a logged-out visitor by IP. */
const countDistinctContacts = async (trainerId: number): Promise<number> => {
  const [row] = await sequelize.query<{ count: string }>(
    `SELECT COUNT(DISTINCT COALESCE('u:' || contact_user_id::text, 'ip:' || contact_ip)) AS count
       FROM trainer_contact_events
      WHERE trainer_id = :trainerId`,
    { replacements: { trainerId }, type: QueryTypes.SELECT }
  );
  return Number(row?.count ?? 0);
};

const countByChannel = async (trainerId: number): Promise<Record<string, number>> => {
  const rows = await sequelize.query<{ channel: string; count: string }>(
    `SELECT channel, COUNT(*) AS count
       FROM trainer_contact_events
      WHERE trainer_id = :trainerId
      GROUP BY channel
      ORDER BY channel`,
    { replacements: { trainerId }, type: QueryTypes.SELECT }
  );
  return Object.fromEntries(rows.map((r) => [r.channel, Number(r.count)]));
};

/**
 * Claims the alert for this trainer. A conditional UPDATE is atomic, so when
 * two taps cross the threshold at once only one of them sends the email.
 */
const claimAlert = async (trainerId: number): Promise<boolean> => {
  const [affected] = await Trainer.update(
    { contactAlertSentAt: new Date() },
    { where: { id: trainerId, contactAlertSentAt: null } }
  );
  return affected > 0;
};

const releaseAlert = async (trainerId: number): Promise<void> => {
  await Trainer.update({ contactAlertSentAt: null }, { where: { id: trainerId } });
};

const alertRecipient = (): string | null => (process.env.CONTACT_ALERT_EMAIL ?? "").trim() || null;

const sendAlert = async (to: string, trainer: Trainer, distinctContacts: number): Promise<void> => {
  const user = await User.findByPk(trainer.userId, {
    attributes: ["firstName", "lastName", "email"],
  });
  const trainerName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || `Antrenor #${trainer.id}`;

  await emailService.sendTrainerContactAlert(to, {
    trainerId: trainer.id,
    trainerName,
    trainerEmail: user?.email ?? "-",
    distinctContacts,
    channelCounts: await countByChannel(trainer.id),
    subscriptionSummary: describeSubscription(trainer),
    profileUrl: trainerPublicUrl(trainer.slug),
  });
};

export type RecordContactResult = "recorded" | "own_profile" | "rate_limited";

export const recordTrainerContact = async ({
  trainer,
  userId,
  ip,
  channel,
}: {
  trainer: Trainer;
  userId: number | null;
  ip: string;
  channel: TrainerContactChannel;
}): Promise<RecordContactResult> => {
  // A trainer checking their own buttons is not a lead.
  if (userId !== null && userId === trainer.userId) return "own_profile";

  const person = userId !== null ? `u:${userId}` : `ip:${ip}`;
  if (isRateLimited(`${trainer.id}:${person}`)) return "rate_limited";

  await TrainerContactEvent.create({
    trainerId: trainer.id,
    contactUserId: userId,
    contactIp: ip.slice(0, 64),
    channel,
  });

  if (trainer.contactAlertSentAt) return "recorded";

  const distinctContacts = await countDistinctContacts(trainer.id);
  if (distinctContacts < CONTACT_ALERT_THRESHOLD) return "recorded";

  const to = alertRecipient();
  if (!to) {
    // Not claimed, so the alert goes out on the first tap after it is set.
    console.warn(
      `[CONTACT ALERT] trainer ${trainer.id} reached ${distinctContacts} contacts, but CONTACT_ALERT_EMAIL is not set`
    );
    return "recorded";
  }
  if (!(await claimAlert(trainer.id))) return "recorded";

  try {
    await sendAlert(to, trainer, distinctContacts);
  } catch (error) {
    // Let the next tap try again rather than losing the alert for good.
    console.error(`[CONTACT ALERT] email for trainer ${trainer.id} failed:`, error);
    await releaseAlert(trainer.id);
  }

  return "recorded";
};
