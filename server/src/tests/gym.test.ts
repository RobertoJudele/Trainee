import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import {
  createTestAdmin,
  createTestGym,
  createTestTrainer,
  createTestUser,
} from "./helpers";

describe("Gym API", () => {
  describe("GET /gyms", () => {
    it("should return gym list", async () => {
      await createTestGym();

      const res = await request(app).get("/gyms");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty("name");
    });
  });

  describe("GET /gyms/:gymId", () => {
    it("should return gym details", async () => {
      const { gym } = await createTestGym();

      const res = await request(app).get(`/gyms/${gym.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(gym.name);
    });

    it("should return 404 for nonexistent gym", async () => {
      const res = await request(app).get("/gyms/99999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /gyms (admin create)", () => {
    it("should allow admin to create a gym", async () => {
      const { token } = await createTestAdmin();

      const res = await request(app)
        .post("/gyms")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Admin Gym",
          address: "456 Admin Street",
          city: "Cluj",
          latitude: 46.7712,
          longitude: 23.6236,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Admin Gym");
    });

    it("should reject non-admin user", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/gyms")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Unauthorized Gym",
          address: "789 Fake Street",
          city: "Test",
          latitude: 44.0,
          longitude: 26.0,
        });

      expect(res.status).toBe(403);
    });

    it("should reject invalid data", async () => {
      const { token } = await createTestAdmin();

      const res = await request(app)
        .post("/gyms")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "X",
          address: "",
          city: "",
          latitude: 999,
          longitude: -999,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /gyms/:gymId/join", () => {
    it("should allow trainer to join a gym", async () => {
      const { token } = await createTestTrainer();
      const { gym } = await createTestGym();

      const res = await request(app)
        .post(`/gyms/${gym.id}/join`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("should reject duplicate join", async () => {
      const { token } = await createTestTrainer();
      const { gym } = await createTestGym();

      await request(app)
        .post(`/gyms/${gym.id}/join`)
        .set("Authorization", `Bearer ${token}`);

      const res = await request(app)
        .post(`/gyms/${gym.id}/join`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PATCH /gyms/:gymId/availability", () => {
    it("should toggle trainer availability at gym", async () => {
      const { token } = await createTestTrainer();
      const { gym } = await createTestGym();

      await request(app)
        .post(`/gyms/${gym.id}/join`)
        .set("Authorization", `Bearer ${token}`);

      const res = await request(app)
        .patch(`/gyms/${gym.id}/availability`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isAvailable: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isAvailable).toBe(false);
    });
  });

  describe("DELETE /gyms/:gymId/leave", () => {
    it("should allow trainer to leave a gym", async () => {
      const { token } = await createTestTrainer();
      const { gym } = await createTestGym();

      await request(app)
        .post(`/gyms/${gym.id}/join`)
        .set("Authorization", `Bearer ${token}`);

      const res = await request(app)
        .delete(`/gyms/${gym.id}/leave`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject leaving a gym not joined", async () => {
      const { token } = await createTestTrainer();
      const { gym } = await createTestGym();

      const res = await request(app)
        .delete(`/gyms/${gym.id}/leave`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
