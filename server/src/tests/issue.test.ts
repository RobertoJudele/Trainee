import "./withDatabase";
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestAdmin, createTestTrainer, createTestUser } from "./helpers";
import { BillingTransaction } from "../models/billingTransaction";
import { BillingProvider } from "../types/trainer";

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

    it("should create a gym request", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetType: "gym",
          category: "gym_request",
          title: "World Class Pipera",
          description: "Str. Dimitrie Pompeiu 5, Bucharest — please add this gym",
          metadata: {
            address: "Str. Dimitrie Pompeiu 5, Bucharest",
            city: "Bucharest",
            latitude: 44.4796,
            longitude: 26.1213,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetType).toBe("gym");
      expect(res.body.data.metadata.latitude).toBe(44.4796);
    });

    it("should reject a gym request without coordinates", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetType: "gym",
          category: "gym_request",
          title: "Nameless Gym Request",
          description: "I forgot to drop a pin on the map for this one",
          metadata: { address: "Somewhere" },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
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

  describe("POST /issues — payment billing snapshot", () => {
    const paymentIssue = {
      targetType: "app",
      category: "payment_issue",
      title: "I was charged twice this month",
      description: "My card shows two charges for the monthly plan",
    };

    it("attaches the trainer's subscription and latest transaction", async () => {
      const { trainer, token } = await createTestTrainer();
      await trainer.update({
        billingProvider: BillingProvider.APPLE,
        iapProductId: "com.trainee.trainer_monthly",
        appleOriginalTransactionId: "2000000111",
      });
      await BillingTransaction.create({
        trainerId: trainer.id,
        amount: 49,
        currency: "RON",
        status: "paid",
        provider: "apple",
        transactionId: "older-tx",
        productId: "com.trainee.trainer_monthly",
        paidAt: new Date("2026-09-01T10:00:00Z"),
      } as any);
      await BillingTransaction.create({
        trainerId: trainer.id,
        amount: 49,
        currency: "RON",
        status: "paid",
        provider: "apple",
        transactionId: "latest-tx",
        productId: "com.trainee.trainer_monthly",
        paidAt: new Date("2026-10-01T10:00:00Z"),
      } as any);

      const res = await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${token}`)
        .send(paymentIssue);

      expect(res.status).toBe(201);
      const billing = res.body.data.metadata.billing;
      expect(billing.trainerId).toBe(trainer.id);
      expect(billing.billingProvider).toBe("apple");
      expect(billing.appleOriginalTransactionId).toBe("2000000111");
      expect(billing.lastTransaction.transactionId).toBe("latest-tx");
    });

    it("records that a client has no subscription", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${token}`)
        .send(paymentIssue);

      expect(res.status).toBe(201);
      expect(res.body.data.metadata.billing.trainerId).toBeNull();
      expect(res.body.data.metadata.billing.lastTransaction).toBeNull();
    });

    it("ignores billing data sent by the client", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetType: "app",
          category: "technical_bug",
          title: "Spoofed billing metadata",
          description: "The client should not be able to set this field",
          metadata: { billing: { trainerId: 999 } },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.metadata?.billing).toBeUndefined();
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
      expect(Array.isArray(res.body.data)).toBe(true);      const listed = res.body.data.find(
        (issue: { title: string }) => issue.title === "Admin visible issue report"
      );
      expect(listed.reporter.email).toBeDefined();
      expect(listed.reporter.firstName).toBe("Test");
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
