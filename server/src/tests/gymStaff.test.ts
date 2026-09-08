import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { TrainerGym } from "../models/trainerGym";
import { Trainer } from "../models/trainer";
import { subStatus } from "../types/trainer";
import {
  createTestAdmin,
  createTestGym,
  createTestTrainer,
  createTestUser,
} from "./helpers";

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

describe("PATCH /gyms/:gymId/staff-request/:trainerId", () => {
  const joinAndRequest = async () => {
    const { token, trainer } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/gyms/${gym.id}/staff-request`).set("Authorization", `Bearer ${token}`);
    return { token, trainer, gym };
  };

  it("lets an admin approve a request", async () => {
    const { trainer, gym } = await joinAndRequest();
    const { token: adminToken, user: admin } = await createTestAdmin();

    const res = await request(app)
      .patch(`/gyms/${gym.id}/staff-request/${trainer.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approve: true });

    expect(res.status).toBe(200);
    expect(res.body.data.staffStatus).toBe("approved");
    expect(res.body.data.staffReviewedBy).toBe(admin.id);
    expect(res.body.data.staffReviewedAt).not.toBeNull();
  });

  it("lets an admin reject a request", async () => {
    const { trainer, gym } = await joinAndRequest();
    const { token: adminToken } = await createTestAdmin();

    const res = await request(app)
      .patch(`/gyms/${gym.id}/staff-request/${trainer.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approve: false });

    expect(res.status).toBe(200);
    expect(res.body.data.staffStatus).toBe("rejected");
  });

  it("allows re-requesting after a rejection", async () => {
    const { token, trainer, gym } = await joinAndRequest();
    const { token: adminToken } = await createTestAdmin();
    await request(app)
      .patch(`/gyms/${gym.id}/staff-request/${trainer.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approve: false });

    const res = await request(app)
      .post(`/gyms/${gym.id}/staff-request`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.staffStatus).toBe("pending");
  });

  it("rejects a non-admin reviewer", async () => {
    const { trainer, gym } = await joinAndRequest();
    const { token: clientToken } = await createTestUser();

    const res = await request(app)
      .patch(`/gyms/${gym.id}/staff-request/${trainer.id}`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ approve: true });

    expect(res.status).toBe(403);
  });

  it("drops the affiliation when the trainer leaves, and rejoining starts at none", async () => {
    const { token, trainer, gym } = await joinAndRequest();
    const { token: adminToken } = await createTestAdmin();
    await request(app)
      .patch(`/gyms/${gym.id}/staff-request/${trainer.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approve: true });

    await request(app).delete(`/gyms/${gym.id}/leave`).set("Authorization", `Bearer ${token}`);
    expect(
      await TrainerGym.findOne({ where: { trainerId: trainer.id, gymId: gym.id } })
    ).toBeNull();

    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    const rejoined = await TrainerGym.findOne({
      where: { trainerId: trainer.id, gymId: gym.id },
    });
    expect(rejoined!.staffStatus).toBe("none");
  });
});

describe("GET /gyms/staff-requests", () => {
  it("lists pending requests for an admin", async () => {
    const { token, trainer } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/gyms/${gym.id}/staff-request`).set("Authorization", `Bearer ${token}`);
    const { token: adminToken } = await createTestAdmin();

    const res = await request(app)
      .get("/gyms/staff-requests")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const match = res.body.data.find(
      (r: any) => r.trainerId === trainer.id && r.gymId === gym.id
    );
    expect(match).toBeDefined();
    expect(match.gymName).toBe(gym.name);
  });

  it("rejects a non-admin", async () => {
    const { token } = await createTestTrainer();
    const res = await request(app)
      .get("/gyms/staff-requests")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("staff status on gym reads", () => {
  it("exposes staffStatus on gym detail trainers", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);

    const res = await request(app).get(`/gyms/${gym.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trainers[0].staffStatus).toBe("none");
  });

  it("reports a pending request as pending, not approved", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/gyms/${gym.id}/staff-request`).set("Authorization", `Bearer ${token}`);

    const res = await request(app).get(`/gyms/${gym.id}`);

    expect(res.body.data.trainers[0].staffStatus).toBe("pending");
  });

  it("orders gym trainers by rankingScore descending", async () => {
    const { gym } = await createTestGym();
    const low = await createTestTrainer();
    const high = await createTestTrainer();
    // rankingScore is a model column but not in TrainerProfileAttributes, so
    // assign-then-save as Review.updateTrainerRating does.
    low.trainer.rankingScore = 3.1;
    await low.trainer.save();
    high.trainer.rankingScore = 4.9;
    await high.trainer.save();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${low.token}`);
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${high.token}`);

    const res = await request(app).get(`/gyms/${gym.id}`);

    expect(res.body.data.trainers.map((t: any) => t.id)).toEqual([
      high.trainer.id,
      low.trainer.id,
    ]);
  });

  it("exposes staffStatus on my-gyms", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .get("/gyms/my-gyms")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data[0].staffStatus).toBe("none");
  });
});

describe("active-subscription scoping on gym pins", () => {
  const lapse = async (trainer: Trainer) => {
    await trainer.update({
      subscriptionStatus: subStatus.TRIAL,
      trialEndsAt: new Date(Date.now() - 60_000),
    });
  };

  it("hides a lapsed trainer from gym detail", async () => {
    const { token, trainer } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await lapse(trainer);

    const res = await request(app).get(`/gyms/${gym.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trainers).toEqual([]);
  });

  it("excludes a lapsed trainer from availableTrainerCount", async () => {
    const { token, trainer } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await lapse(trainer);

    // Geo path bypasses the 30s bulk cache.
    const res = await request(app).get(`/gyms?lat=${gym.latitude}&lng=${gym.longitude}`);

    const row = res.body.data.find((g: any) => g.id === gym.id);
    expect(row.availableTrainerCount).toBe(0);
  });

  it("still counts an active trainer", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);

    const res = await request(app).get(`/gyms?lat=${gym.latitude}&lng=${gym.longitude}`);

    const row = res.body.data.find((g: any) => g.id === gym.id);
    expect(row.availableTrainerCount).toBe(1);
  });
});
