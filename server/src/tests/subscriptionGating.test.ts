import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestTrainer, createTestUser } from "./helpers";
import { Trainer } from "../models/trainer";
import { subStatus } from "../types/trainer";

// A trainer whose trial has run out and who never bought anything: the exact
// state a founding trainer lands in once their grant expires.
let lapsedToken: string;
let lapsedTrainerId: number;
let activeToken: string;
let clientToken: string;

beforeAll(async () => {
  const lapsed = await createTestTrainer();
  lapsedToken = lapsed.token;
  lapsedTrainerId = lapsed.trainer.id;
  await Trainer.update(
    { trialEndsAt: new Date(Date.now() - 86_400_000), subscriptionStatus: subStatus.TRIAL },
    { where: { id: lapsed.trainer.id } },
  );

  activeToken = (await createTestTrainer()).token;
  clientToken = (await createTestUser({ role: "client" })).token;
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("subscription gating", () => {
  it("blocks the schedule writes the paywall sells", async () => {
    const res = await request(app)
      .post("/trainer-schedule/working-hours")
      .set(auth(lapsedToken))
      .send({ dayOfWeek: 1, startTime: "09:00", endTime: "17:00", slotDurationMin: 60 });

    expect(res.status).toBe(402);
  });

  it("blocks profile view analytics", async () => {
    const res = await request(app).get("/trainer/analytics").set(auth(lapsedToken));
    expect(res.status).toBe(402);
  });

  it("blocks creating a package", async () => {
    const res = await request(app)
      .post("/trainer-packages")
      .set(auth(lapsedToken))
      .send({ name: "5 sessions", price: 500, sessionCount: 5 });

    expect(res.status).toBe(402);
  });

  it("still allows an active trainer through", async () => {
    const res = await request(app)
      .post("/trainer-schedule/working-hours")
      .set(auth(activeToken))
      .send({ dayOfWeek: 1, startTime: "09:00", endTime: "17:00", slotDurationMin: 60 });

    expect(res.status).toBeLessThan(400);
  });

  it("still allows reads, so the schedule screen loads instead of erroring", async () => {
    const res = await request(app).get("/trainer-schedule/working-hours").set(auth(lapsedToken));
    expect(res.status).toBe(200);
  });

  it("never blocks withdrawal — a lapsed trainer can still unblock a date", async () => {
    // Gate what creates value, never what undoes it, or a trainer who stops
    // paying is locked out of their own data.
    const res = await request(app)
      .delete("/trainer-schedule/blocked-dates/2027-01-01")
      .set(auth(lapsedToken));

    expect(res.status).not.toBe(402);
  });

  it("leaves client endpoints alone", async () => {
    // /my-schedule belongs to clients. The middleware resolves a *trainer's*
    // billing state, so gating this would lock every client out of their own
    // schedule.
    const res = await request(app)
      .get("/trainer-schedule/my-schedule")
      .set(auth(clientToken))
      .query({ from: "2026-08-01", to: "2026-08-31" });

    expect(res.status).toBe(200);
  });

  it("answers 403, not 402, when the caller is not a trainer at all", async () => {
    const res = await request(app).get("/trainer/analytics").set(auth(clientToken));
    expect(res.status).toBe(403);
  });

  it("keeps the trainer's public profile reachable while lapsed", async () => {
    // The paywall's actual promise is that a lapsed trainer is hidden from
    // search, not that their profile 402s for everyone who has the link.
    const res = await request(app).get(`/trainer/${lapsedTrainerId}`);
    expect(res.status).toBe(200);
  });
});
