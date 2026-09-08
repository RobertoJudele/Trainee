import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { TrainerGym } from "../models/trainerGym";
import { createTestGym, createTestTrainer } from "./helpers";

describe("trainer_gyms staff columns", () => {
  it("defaults a new affiliation to 'none' with no review metadata", async () => {
    const { trainer } = await createTestTrainer();
    const { gym } = await createTestGym();

    const row = await TrainerGym.create({
      trainerId: trainer.id,
      gymId: gym.id,
      isAvailable: true,
    });

    expect(row.staffStatus).toBe("none");
    expect(row.staffRequestedAt).toBeNull();
    expect(row.staffReviewedAt).toBeNull();
    expect(row.staffReviewedBy).toBeNull();
  });
});

describe("POST /gyms/:gymId/staff-request", () => {
  it("sets a joined trainer's affiliation to pending", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .post(`/gyms/${gym.id}/staff-request`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.staffStatus).toBe("pending");
    expect(res.body.data.staffRequestedAt).not.toBeNull();
  });

  it("rejects a request for a gym the trainer has not joined", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();

    const res = await request(app)
      .post(`/gyms/${gym.id}/staff-request`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("is a no-op when already pending", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/gyms/${gym.id}/staff-request`).set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .post(`/gyms/${gym.id}/staff-request`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.staffStatus).toBe("pending");
  });

  it("requires authentication", async () => {
    const { gym } = await createTestGym();
    const res = await request(app).post(`/gyms/${gym.id}/staff-request`);
    expect(res.status).toBe(401);
  });
});
