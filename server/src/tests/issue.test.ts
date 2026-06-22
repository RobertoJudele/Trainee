import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestAdmin, createTestTrainer, createTestUser } from "./helpers";

describe("Issue API", () => {
  describe("POST /issues", () => {
    it("should create an app issue", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetType: "app",
          category: "technical_bug",
          title: "Button not working on home screen",
          description: "The search button does not respond when tapped on iOS 18",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("open");
      expect(res.body.data.targetType).toBe("app");
    });

    it("should create a trainer issue", async () => {
      const { token } = await createTestUser();
      const { trainer } = await createTestTrainer();

      const res = await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetType: "trainer",
          category: "trainer_behavior",
          title: "Trainer was unprofessional during session",
          description: "The trainer showed up 30 minutes late and was rude to me",
          trainerId: trainer.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetType).toBe("trainer");
    });

    it("should reject invalid data", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetType: "app",
          category: "technical_bug",
          title: "Too",
          description: "Short",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject without auth", async () => {
      const res = await request(app)
        .post("/issues")
        .send({
          targetType: "app",
          category: "technical_bug",
          title: "No auth issue report",
          description: "This should be rejected because no auth",
        });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /issues/me", () => {
    it("should return own issues", async () => {
      const { token } = await createTestUser();

      await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetType: "app",
          category: "other",
          title: "My test issue for listing",
          description: "This issue should appear in my issues list",
        });

      const res = await request(app)
        .get("/issues/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("should return empty if no issues", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/issues/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("GET /issues (admin)", () => {
    it("should allow admin to list all issues", async () => {
      const { token: userToken } = await createTestUser();
      const { token: adminToken } = await createTestAdmin();

      await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          targetType: "app",
          category: "technical_bug",
          title: "Admin visible issue report",
          description: "This issue should be visible to the admin user",
        });

      const res = await request(app)
        .get("/issues")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should reject non-admin", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/issues")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /issues/:issueId/status (admin)", () => {
    it("should allow admin to update issue status", async () => {
      const { token: userToken } = await createTestUser();
      const { token: adminToken } = await createTestAdmin();

      const createRes = await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          targetType: "app",
          category: "other",
          title: "Issue to be resolved by admin",
          description: "Admin will resolve this test issue shortly",
        });

      const issueId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/issues/${issueId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          status: "resolved",
          resolutionNote: "Fixed in latest release",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("resolved");
      expect(res.body.data.resolutionNote).toBe("Fixed in latest release");
    });

    it("should reject non-admin", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch("/issues/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "resolved" });

      expect(res.status).toBe(403);
    });
  });
});
