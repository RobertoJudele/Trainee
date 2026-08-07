import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestUser, createTestTrainer } from "./helpers";
import { Specialization } from "../models/specialization";
import { Trainer } from "../models/trainer";
import { buildPointFromLatLng } from "../utils/geo";
import { subStatus } from "../types/trainer";

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

    // Romanians type "bucuresti" and "stefan" while the stored data reads
    // "București" / "Ștefan" — unaccent() on both sides has to bridge that,
    // including the cedilla ş (U+015F) Windows keyboards emit for comma-below ș.
    it("matches city and name regardless of diacritics", async () => {
      const { user } = await createTestUser({
        role: "trainer",
        firstName: "Ștefan",
        lastName: "Ionescu",
      });
      const trainer = await Trainer.create({
        userId: user.id,
        bio: "Antrenor personal",
        experienceYears: 5,
        locationCity: "București",
        locationState: "București",
        subscriptionStatus: subStatus.TRIAL,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      } as any);

      const idsOf = (res: any) => res.body.data.trainers.map((t: any) => t.internalId);

      const byPlainCity = await request(app)
        .get("/trainer/search")
        .query({ city: "bucuresti" });
      expect(byPlainCity.status).toBe(200);
      expect(idsOf(byPlainCity)).toContain(trainer.id);

      const byCedillaCity = await request(app)
        .get("/trainer/search")
        .query({ city: "Bucureşti" });
      expect(byCedillaCity.status).toBe(200);
      expect(idsOf(byCedillaCity)).toContain(trainer.id);

      const byPlainName = await request(app)
        .get("/trainer/search")
        .query({ q: "stefan" });
      expect(byPlainName.status).toBe(200);
      expect(idsOf(byPlainName)).toContain(trainer.id);

      // Typing a place name into the search bar (q, not the City filter) has to
      // find trainers based there — neither the bio nor the name says "bucuresti".
      const byCityInSearchBar = await request(app)
        .get("/trainer/search")
        .query({ q: "bucuresti" });
      expect(byCityInSearchBar.status).toBe(200);
      expect(idsOf(byCityInSearchBar)).toContain(trainer.id);
    });

    // Regression for the whereMergeStrategy bug: the radius path adds a
    // TOP-LEVEL Op.and (ST_DWithin literal) to the same where object the
    // active-subscription scope also keys off Op.and for. Under the default
    // "overwrite" merge strategy the query's Op.and clobbers the scope's,
    // silently dropping the active filter — see src/db.ts whereMergeStrategy.
    it("excludes inactive trainers from a radius (geo) search", async () => {
      const lat = 44.4268;
      const lng = 26.1025;
      const point = buildPointFromLatLng(lat, lng);

      const { user: activeUser } = await createTestUser({ role: "trainer" });
      const activeTrainer = await Trainer.create({
        userId: activeUser.id,
        bio: "Active geo trainer",
        experienceYears: 5,
        locationCity: "Bucharest",
        locationState: "Bucharest",
        location: point,
        subscriptionStatus: subStatus.TRIAL,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      } as any);

      const { user: inactiveUser } = await createTestUser({ role: "trainer" });
      const inactiveTrainer = await Trainer.create({
        userId: inactiveUser.id,
        bio: "Inactive geo trainer",
        experienceYears: 5,
        locationCity: "Bucharest",
        locationState: "Bucharest",
        location: point,
        subscriptionStatus: subStatus.CANCELED,
      } as any);

      const res = await request(app)
        .get("/trainer/search")
        .query({ lat, lng, radiusKm: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.trainers.map((t: any) => t.internalId);
      expect(ids).toContain(activeTrainer.id);
      expect(ids).not.toContain(inactiveTrainer.id);
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
