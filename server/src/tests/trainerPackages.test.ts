import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestUser, createTestTrainer } from "./helpers";
import { Trainer } from "../models/trainer";

describe("Trainer Packages API", () => {
  describe("POST /trainer-packages", () => {
    it("should create a package", async () => {
      const { token } = await createTestTrainer();

      const res = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Starter Pack",
          price: 120,
          sessionCount: 4,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Starter Pack");
      expect(Number(res.body.data.price)).toBe(120);
      expect(res.body.data.sessionCount).toBe(4);
    });

    it("should reject if not a trainer", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Fake Pack",
          price: 100,
          sessionCount: 2,
        });

      expect(res.status).toBe(403);
    });

    it("should reject without auth", async () => {
      const res = await request(app)
        .post("/trainer-packages")
        .send({ name: "No Auth", price: 50, sessionCount: 1 });

      expect(res.status).toBe(401);
    });

    it("should reject invalid data", async () => {
      const { token } = await createTestTrainer();

      const res = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "",
          price: -5,
          sessionCount: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should enforce max 5 packages", async () => {
      const { token } = await createTestTrainer();

      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/trainer-packages")
          .set("Authorization", `Bearer ${token}`)
          .send({
            name: `Pack ${i + 1}`,
            price: 100 + i * 10,
            sessionCount: i + 1,
          });
      }

      const res = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Pack 6",
          price: 200,
          sessionCount: 6,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /trainer-packages/:trainerId", () => {
    it("should return packages for a trainer", async () => {
      const { trainer, token } = await createTestTrainer();

      await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Gold", price: 200, sessionCount: 8 });

      const res = await request(app)
        .get(`/trainer-packages/${trainer.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe("Gold");
    });

    it("should return empty array for trainer with no packages", async () => {
      const { trainer } = await createTestTrainer();

      const res = await request(app)
        .get(`/trainer-packages/${trainer.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("PUT /trainer-packages/:id", () => {
    it("should update a package", async () => {
      const { token } = await createTestTrainer();

      const createRes = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Original", price: 100, sessionCount: 4 });

      const pkgId = createRes.body.data.id;

      const res = await request(app)
        .put(`/trainer-packages/${pkgId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated", price: 150 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Updated");
      expect(Number(res.body.data.price)).toBe(150);
    });

    it("should reject update from non-owner", async () => {
      const { token: ownerToken } = await createTestTrainer();
      const { token: otherToken } = await createTestTrainer();

      const createRes = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Owner Pack", price: 100, sessionCount: 2 });

      const pkgId = createRes.body.data.id;

      const res = await request(app)
        .put(`/trainer-packages/${pkgId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Stolen" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /trainer-packages/:id", () => {
    it("should delete a package", async () => {
      const { token } = await createTestTrainer();

      const createRes = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "ToDelete", price: 80, sessionCount: 2 });

      const pkgId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/trainer-packages/${pkgId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject delete from non-owner", async () => {
      const { token: ownerToken } = await createTestTrainer();
      const { token: otherToken } = await createTestTrainer();

      const createRes = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Not Yours", price: 100, sessionCount: 3 });

      const pkgId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/trainer-packages/${pkgId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("Session rate recalculation", () => {
    it("should set sessionRate to lowest per-session price", async () => {
      const { trainer, token } = await createTestTrainer();

      await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Basic", price: 120, sessionCount: 4 });

      await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Premium", price: 200, sessionCount: 10 });

      const updated = await Trainer.findByPk(trainer.id);
      expect(Number(updated!.sessionRate)).toBe(20);
    });

    it("should clear sessionRate when all packages deleted", async () => {
      const { trainer, token } = await createTestTrainer();

      const createRes = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Solo", price: 50, sessionCount: 1 });

      const pkgId = createRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/trainer-packages/${pkgId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);

      const updated = await Trainer.findByPk(trainer.id);
      expect(updated!.sessionRate).toBeNull();
    });
  });
});
