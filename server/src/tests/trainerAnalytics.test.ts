import "./withDatabase";
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestTrainer } from "./helpers";
import { summarizeTrainerAnalytics } from "../services/trainerAnalytics";
import { ProfileViewEvent } from "../models/profileViewEvent";
import { TrainerContactEvent } from "../models/trainerContactEvent";

const NOW = new Date("2026-11-08T12:00:00Z");
const daysAgo = (n: number, hours = 0) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000 - hours * 60 * 60 * 1000);

const contact = (
  createdAt: Date,
  who: { user?: number; ip?: string },
  channel: "whatsapp" | "instagram" | "facebook" = "whatsapp"
) => ({ createdAt, contactUserId: who.user ?? null, contactIp: who.ip ?? "1.1.1.1", channel });

describe("summarizeTrainerAnalytics", () => {
  it("splits views and contacts into this week and last week", () => {
    const views = [
      { createdAt: daysAgo(1), sourceType: "search" as const },
      { createdAt: daysAgo(2), sourceType: "map" as const },
      { createdAt: daysAgo(9), sourceType: "search" as const },
    ];
    const contacts = [contact(daysAgo(1), { user: 1 }), contact(daysAgo(10), { user: 2 })];

    const result = summarizeTrainerAnalytics(views, contacts, 50, NOW);

    expect(result.totalViews).toBe(50);
    expect(result.thisWeek).toEqual({ views: 2, contacts: 1 });
    expect(result.lastWeek).toEqual({ views: 1, contacts: 1 });
  });

  it("counts a person who taps several times as one contact", () => {
    const contacts = [
      contact(daysAgo(1), { user: 7 }),
      contact(daysAgo(1, 2), { user: 7 }, "instagram"),
      contact(daysAgo(2), { ip: "9.9.9.9" }),
      contact(daysAgo(3), { ip: "9.9.9.9" }),
    ];

    const result = summarizeTrainerAnalytics([], contacts, 0, NOW);

    expect(result.thisWeek.contacts).toBe(2);
    expect(result.channels).toEqual({ whatsapp: 2, instagram: 1, facebook: 0 });
  });

  it("returns seven days ending today, with views and contacts per day", () => {
    const result = summarizeTrainerAnalytics(
      [{ createdAt: daysAgo(0), sourceType: "direct" }],
      [contact(daysAgo(0), { user: 1 })],
      1,
      NOW
    );

    expect(result.days).toHaveLength(7);
    expect(result.days[6]).toEqual({ date: "2026-11-08", views: 1, contacts: 1 });
    expect(result.days[0].date).toBe("2026-11-02");
  });

  it("buckets sources over 30 days and files unknown ones under other", () => {
    const result = summarizeTrainerAnalytics(
      [
        { createdAt: daysAgo(20), sourceType: "search" },
        { createdAt: daysAgo(5), sourceType: null },
        { createdAt: daysAgo(40), sourceType: "map" },
      ],
      [],
      0,
      NOW
    );

    expect(result.sources).toEqual({ search: 1, map: 0, direct: 0, other: 1 });
  });
});

describe("GET /trainer/analytics", () => {
  it("returns the new numbers without demographics or viewer IPs", async () => {
    const { token, trainer } = await createTestTrainer();
    await ProfileViewEvent.create({
      trainerId: trainer.id,
      viewerIpAddress: "5.5.5.5",
      sourceType: "search",
      viewedAt: new Date(),
    } as never);
    await TrainerContactEvent.create({
      trainerId: trainer.id,
      contactUserId: null,
      contactIp: "5.5.5.5",
      channel: "whatsapp",
    });

    const res = await request(app)
      .get("/trainer/analytics")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.thisWeek).toEqual({ views: 1, contacts: 1 });
    expect(res.body.data.channels.whatsapp).toBe(1);
    expect(res.body.data.sources.search).toBe(1);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("5.5.5.5");
    // Old app builds still get the fields they read, with nothing personal in them.
    expect(res.body.data.sourceBreakdown.search).toBe(1);
    expect(res.body.data.viewsByDay).toHaveLength(7);
    expect(res.body.data.ageBreakdown.unknown).toBe(1);
    expect(res.body.data.sexBreakdown.unknown).toBe(1);
    expect(res.body.data.recentViews).toEqual([]);
  });
});
