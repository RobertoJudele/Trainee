import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestUser, createTestTrainer } from "./helpers";
import { Specialization } from "../models/specialization";

describe("Trainer API", () => {
  describe("POST /trainer/create", () => {
    it("should create a trainer profile", async () => {
      const { token } = await createTestUser();
      const specs = await Specialization.findAll({ limit: 1 });

      const res = await request(app)
        .post("/trainer/create")
        .set("Authorization", `Bearer ${token}`)
        .send({
          bio: "I am a fitness trainer with 5 years of experience.",
          experienceYears: 5,
          locationCity: "Bucharest",
          locationState: "Bucharest",
          locationCountry: "Romania",
          specializationIds: [specs[0].id],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("publicId");
      expect(res.body.data).toHaveProperty("bio");
    });

    it("should reject if user is already a trainer", async () => {
      const { token } = await createTestTrainer();
      const specs = await Specialization.findAll({ limit: 1 });

      const res = await request(app)
        .post("/trainer/create")
        .set("Authorization", `Bearer ${token}`)
        .send({
          bio: "Duplicate trainer",
          experienceYears: 3,
          locationCity: "Cluj",
          locationState: "Cluj",
          locationCountry: "Romania",
          specializationIds: [specs[0].id],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject without auth", async () => {
      const res = await request(app)
        .post("/trainer/create")
        .send({ bio: "No auth" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /trainer (own profile)", () => {
    it("should return own trainer profile", async () => {
      const { token } = await createTestTrainer();

      const res = await request(app)
        .get("/trainer")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("bio");
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/trainer");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /trainer/search", () => {
    it("should return trainers list", async () => {
      await createTestTrainer({ bio: "Searchable trainer bio" });

      const res = await request(app).get("/trainer/search");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.trainers)).toBe(true);
    });

    it("should filter by text query", async () => {
      const uniqueBio = `UniqueSearchTerm${Date.now()}`;
      await createTestTrainer({ bio: uniqueBio });

      const res = await request(app)
        .get("/trainer/search")
        .query({ q: uniqueBio });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /trainer/:trainerId (public)", () => {
    it("should return trainer by public ID", async () => {
      const { trainer } = await createTestTrainer();
      const publicId = trainer.publicId;

      const res = await request(app).get(`/trainer/${publicId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("bio");
    });

    it("should return 400 for invalid trainer ID format", async () => {
      const res = await request(app).get("/trainer/nonexistent-uuid-1234");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 for valid UUID that does not exist", async () => {
      const res = await request(app).get("/trainer/00000000-0000-4000-a000-000000000000");

      expect(res.status).toBe(404);
    });
  });
});
