// src/services/trainerAnalytics.ts
//
// What a trainer sees on their analytics screen: whether the profile turns
// views into messages. Three numbers carry it — views, contacts and the rate
// between them — for this week against last week, plus where views come from
// and which button people use to write.
//
// Deliberately no viewer demographics or IPs: the app never asks for age or
// sex, and at a few dozen views a week a breakdown would point at individuals.
import { Op } from "sequelize";
import { ProfileViewEvent, ProfileViewSourceType } from "../models/profileViewEvent";
import { TrainerContactEvent, TrainerContactChannel } from "../models/trainerContactEvent";

const DAY_MS = 24 * 60 * 60 * 1000;
// Sources and channels look back further than a week so a quiet profile still
// has enough to show.
const BREAKDOWN_DAYS = 30;

export interface PeriodTotals {
  views: number;
  contacts: number;
}

export interface TrainerAnalytics {
  totalViews: number;
  thisWeek: PeriodTotals;
  lastWeek: PeriodTotals;
  days: { date: string; views: number; contacts: number }[];
  sources: Record<ProfileViewSourceType, number>;
  channels: Record<TrainerContactChannel, number>;
}

interface ViewRow {
  createdAt: Date;
  sourceType: ProfileViewSourceType | null;
}

interface ContactRow {
  createdAt: Date;
  contactUserId: number | null;
  contactIp: string;
  channel: TrainerContactChannel;
}

// One person tapping WhatsApp three times is one contact.
const personKey = (row: ContactRow): string =>
  row.contactUserId !== null ? `u:${row.contactUserId}` : `ip:${row.contactIp}`;

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

const distinctPeople = (rows: ContactRow[]): number => new Set(rows.map(personKey)).size;

/** Pure: shapes raw event rows into the screen's numbers. Exported for tests. */
export function summarizeTrainerAnalytics(
  views: ViewRow[],
  contacts: ContactRow[],
  totalViews: number,
  now: Date = new Date()
): TrainerAnalytics {
  const weekStart = new Date(now.getTime() - 7 * DAY_MS);
  const prevWeekStart = new Date(now.getTime() - 14 * DAY_MS);
  const breakdownStart = new Date(now.getTime() - BREAKDOWN_DAYS * DAY_MS);

  const inRange = <T extends { createdAt: Date }>(rows: T[], from: Date, to: Date) =>
    rows.filter((r) => r.createdAt >= from && r.createdAt < to);

  const viewsThisWeek = inRange(views, weekStart, now);
  const viewsLastWeek = inRange(views, prevWeekStart, weekStart);
  const contactsThisWeek = inRange(contacts, weekStart, now);
  const contactsLastWeek = inRange(contacts, prevWeekStart, weekStart);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = dayKey(new Date(now.getTime() - (6 - index) * DAY_MS));
    return {
      date,
      views: views.filter((v) => dayKey(v.createdAt) === date).length,
      contacts: distinctPeople(contacts.filter((c) => dayKey(c.createdAt) === date)),
    };
  });

  const sources: Record<ProfileViewSourceType, number> = { search: 0, map: 0, direct: 0, other: 0 };
  for (const view of inRange(views, breakdownStart, now)) {
    const source = view.sourceType && view.sourceType in sources ? view.sourceType : "other";
    sources[source] += 1;
  }

  const recentContacts = inRange(contacts, breakdownStart, now);
  const channels: Record<TrainerContactChannel, number> = {
    whatsapp: distinctPeople(recentContacts.filter((c) => c.channel === "whatsapp")),
    instagram: distinctPeople(recentContacts.filter((c) => c.channel === "instagram")),
    facebook: distinctPeople(recentContacts.filter((c) => c.channel === "facebook")),
  };

  return {
    totalViews,
    thisWeek: { views: viewsThisWeek.length, contacts: distinctPeople(contactsThisWeek) },
    lastWeek: { views: viewsLastWeek.length, contacts: distinctPeople(contactsLastWeek) },
    days,
    sources,
    channels,
  };
}

export async function getTrainerAnalytics(
  trainerId: number,
  totalViews: number,
  now: Date = new Date()
): Promise<TrainerAnalytics> {
  const since = new Date(now.getTime() - BREAKDOWN_DAYS * DAY_MS);
  const [views, contacts] = await Promise.all([
    ProfileViewEvent.findAll({
      where: { trainerId, createdAt: { [Op.gte]: since } },
      attributes: ["createdAt", "sourceType"],
      raw: true,
    }),
    TrainerContactEvent.findAll({
      where: { trainerId, createdAt: { [Op.gte]: since } },
      attributes: ["createdAt", "contactUserId", "contactIp", "channel"],
      raw: true,
    }),
  ]);

  return summarizeTrainerAnalytics(
    views.map((v) => ({ createdAt: new Date(v.createdAt), sourceType: v.sourceType })),
    contacts.map((c) => ({
      createdAt: new Date(c.createdAt),
      contactUserId: c.contactUserId ?? null,
      contactIp: c.contactIp,
      channel: c.channel,
    })),
    totalViews,
    now
  );
}
