import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestTrainer, createTestUser } from "./helpers";
import { Specialization } from "../models/specialization";

describe("Trainer Specialization API", () => {
  describe("POST /trainer-specializations", () => {
    it("should add specializations to a trainer", async () => {
      const { token } = await createTestTrainer();
      const specs = await Specialization.findAll({ limit: 2 });

      const res = await request(app)
        .post("/trainer-specializations")
        .set("Authorization", `Bearer ${token}`)
        .send({
          specializations: specs.map((s) => ({
            specializationId: s.id,
            experienceLevel: "intermediate",
          })),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("should reject duplicates when all already exist", async () => {
      const { token } = await createTestTrainer();
      const specs = await Specialization.findAll({ limit: 1 });

      const payload = {
        specializations: [{ specializationId: specs[0].id }],
      };

      await request(app)
        .post("/trainer-specializations")
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

      const res = await request(app)
        .post("/trainer-specializations")
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should reject for non-trainer user", async () => {
      const { token } = await createTestUser();
      const specs = await Specialization.findAll({ limit: 1 });

      const res = await request(app)
        .post("/trainer-specializations")
        .set("Authorization", `Bearer ${token}`)
        .send({
          specializations: [{ specializationId: specs[0].id }],
        });

      expect(res.status).toBe(403);
    });

    it("should reject without auth", async () => {
      const res = await request(app)
        .post("/trainer-specializations")
        .send({ specializations: [{ specializationId: 1 }] });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /trainer-specializations", () => {
    it("should return trainer specializations", async () => {
      const { token } = await createTestTrainer();
      const specs = await Specialization.findAll({ limit: 1 });

      await request(app)
        .post("/trainer-specializations")
        .set("Authorization", `Bearer ${token}`)
        .send({
          specializations: [{ specializationId: specs[0].id }],
        });

      const res = await request(app)
        .get("/trainer-specializations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
