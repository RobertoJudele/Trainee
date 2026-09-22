import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestTrainer, createTestUser } from "./helpers";
import { TrainerClient } from "../models/trainerClient";

// UserBlock has always had a model, a controller and a settings screen, but
// nothing outside its own feature read it: search, recommendations and
// reviews all showed a blocked trainer or a blocked reviewer exactly as if
// no block existed. These are the three places that actually consume a
// block today, per the frontend (app/trainers/[id].tsx blocks a trainer or a
// review's author).
//
// Search/recommendation cards never expose the trainer's User id (only
// `internalId`, the Trainer PK) - the block itself is keyed on User ids
// (blockerId/blockedId), so these tests block by trainerUser.id but assert
// by trainer.id.
describe("UserBlock enforcement", () => {
  describe("trainer search", () => {
    it("excludes a trainer the client blocked", async () => {
      const { token: clientToken } = await createTestUser();
      const { user: trainerUser, trainer } = await createTestTrainer();

      const blockRes = await request(app)
        .post("/blocks")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ blockedUserId: trainerUser.id });
      expect(blockRes.status).toBe(201);

      const res = await request(app)
        .get("/trainer/search")
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.trainers.map((t: { internalId: number }) => t.internalId);
      expect(ids).not.toContain(trainer.id);

      // Sanity: the block is real, not just an always-empty result - a
      // different client still sees this trainer.
      const { token: strangerToken } = await createTestUser();
      const strangerRes = await request(app)
        .get("/trainer/search")
        .set("Authorization", `Bearer ${strangerToken}`);
      const strangerIds = strangerRes.body.data.trainers.map(
        (t: { internalId: number }) => t.internalId
      );
      expect(strangerIds).toContain(trainer.id);
    });

    it("is mutual: excludes a trainer who blocked the client", async () => {
      const { user: clientUser, token: clientToken } = await createTestUser();
      const { trainer, token: trainerToken } = await createTestTrainer();

      // The trainer's own user account blocks the client - the reverse
      // direction from the app's own "block this trainer" flow, but the
      // model and the enforcement are symmetric either way.
      const blockRes = await request(app)
        .post("/blocks")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ blockedUserId: clientUser.id });
      expect(blockRes.status).toBe(201);

      const res = await request(app)
        .get("/trainer/search")
        .set("Authorization", `Bearer ${clientToken}`);

      const ids = res.body.data.trainers.map((t: { internalId: number }) => t.internalId);
      expect(ids).not.toContain(trainer.id);
    });

    it("still returns everything for an anonymous request", async () => {
      const { trainer } = await createTestTrainer();

      const res = await request(app).get("/trainer/search");

      expect(res.status).toBe(200);
      const ids = res.body.data.trainers.map((t: { internalId: number }) => t.internalId);
      expect(ids).toContain(trainer.id);
    });
  });

  describe("recommendations", () => {
    it("excludes a blocked trainer from suggestions", async () => {
      const { token: clientToken } = await createTestUser();
      const { user: trainerUser, trainer } = await createTestTrainer();

      const blockRes = await request(app)
        .post("/blocks")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ blockedUserId: trainerUser.id });
      expect(blockRes.status).toBe(201);

      const res = await request(app)
        .get("/recommendations/trainers")
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      const list = res.body.data.trainers ?? res.body.data;
      const ids = list.map((t: { internalId: number }) => t.internalId);
      expect(ids).not.toContain(trainer.id);
    });
  });

  describe("trainer reviews", () => {
    it("excludes a review left by a blocked client", async () => {
      const { user: reviewer, token: reviewerToken } = await createTestUser();
      const { trainer } = await createTestTrainer();

      // The reviewer needs to be on the trainer's roster to be allowed to
      // review at all - connect them the same way a booking would.
      await TrainerClient.create({ trainerId: trainer.id, clientId: reviewer.id });

      const createRes = await request(app)
        .post(`/reviews/${trainer.id}`)
        .set("Authorization", `Bearer ${reviewerToken}`)
        .send({ rating: 5, reviewText: "Great trainer, would recommend to anyone reading this." });
      expect(createRes.status).toBe(201);

      // Some other client blocks the reviewer.
      const { token: blockerToken } = await createTestUser();
      const blockRes = await request(app)
        .post("/blocks")
        .set("Authorization", `Bearer ${blockerToken}`)
        .send({ blockedUserId: reviewer.id });
      expect(blockRes.status).toBe(201);

      const blockedView = await request(app)
        .get(`/reviews/${trainer.id}`)
        .set("Authorization", `Bearer ${blockerToken}`);
      expect(blockedView.status).toBe(200);
      expect(
        blockedView.body.data.map((r: { clientId: number }) => r.clientId)
      ).not.toContain(reviewer.id);

      const anonView = await request(app).get(`/reviews/${trainer.id}`);
      expect(anonView.status).toBe(200);
      expect(anonView.body.data.map((r: { clientId: number }) => r.clientId)).toContain(
        reviewer.id
      );
    });
  });
});
