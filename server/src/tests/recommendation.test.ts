import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import {
  createTestGym,
  createTestTrainer,
  createTestUser,
} from "./helpers";
import { Specialization } from "../models/specialization";

describe("Recommendation API", () => {
  describe("PUT /recommendations/preferences", () => {
    it("should create preferences", async () => {
      const { token } = await createTestUser();
      const { gym } = await createTestGym();
      const specs = await Specialization.findAll({ limit: 1 });

      const res = await request(app)
        .put("/recommendations/preferences")
        .set("Authorization", `Bearer ${token}`)
        .send({
          fitnessLevel: "beginner",
          budgetMin: 20,
          budgetMax: 100,
          preferredGymId: gym.id,
          preferredSpecializationIds: [specs[0].id],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fitnessLevel).toBe("beginner");
    });

    it("should update existing preferences", async () => {
      const { token } = await createTestUser();

      await request(app)
        .put("/recommendations/preferences")
        .set("Authorization", `Bearer ${token}`)
        .send({ fitnessLevel: "beginner" });

      const res = await request(app)
        .put("/recommendations/preferences")
        .set("Authorization", `Bearer ${token}`)
        .send({ fitnessLevel: "expert" });

      expect(res.status).toBe(200);
      expect(res.body.data.fitnessLevel).toBe("expert");
    });
  });

  describe("GET /recommendations/preferences", () => {
    it("should return preferences", async () => {
      const { token } = await createTestUser();

      await request(app)
        .put("/recommendations/preferences")
        .set("Authorization", `Bearer ${token}`)
        .send({ fitnessLevel: "intermediate" });

      const res = await request(app)
        .get("/recommendations/preferences")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fitnessLevel).toBe("intermediate");
    });

    it("should return null if no preferences set", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/recommendations/preferences")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });

  describe("GET /recommendations/trainers", () => {
    it("should return ranked trainers", async () => {
      await createTestTrainer({ bio: "Recommendation test trainer" });
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/recommendations/trainers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("trainers");
      expect(res.body.data).toHaveProperty("pagination");
      expect(Array.isArray(res.body.data.trainers)).toBe(true);
    });

    it("should reject without auth", async () => {
      const res = await request(app).get("/recommendations/trainers");

      expect(res.status).toBe(401);
    });
  });
});
