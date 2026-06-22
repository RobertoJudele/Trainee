import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestAdmin, createTestUser } from "./helpers";

describe("Specialization API", () => {
  describe("GET /specialization", () => {
    it("should return seeded specializations (public)", async () => {
      const res = await request(app).get("/specialization");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty("name");
      expect(res.body.data[0]).toHaveProperty("description");
    });
  });

  describe("POST /specialization", () => {
    it("should allow admin to create a specialization", async () => {
      const { token } = await createTestAdmin();

      const res = await request(app)
        .post("/specialization")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Aqua Fitness",
          description: "Water-based fitness training",
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Aqua Fitness");
    });

    it("should reject without auth", async () => {
      const res = await request(app)
        .post("/specialization")
        .send({ name: "No Auth Spec" });

      expect(res.status).toBe(401);
    });
  });
});
