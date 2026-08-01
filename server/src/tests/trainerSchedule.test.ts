import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestTrainer, createTestUser } from "./helpers";

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

describe("Trainer Schedule API", () => {
  describe("Working hours", () => {
    it("should create a working hour template", async () => {
      const { token } = await createTestTrainer();

      const res = await request(app)
        .post("/trainer-schedule/working-hours")
        .set("Authorization", `Bearer ${token}`)
        .send({
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "17:00",
          slotDurationMin: 60,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dayOfWeek).toBe(1);
    });

    it("should update existing working hour", async () => {
      const { token } = await createTestTrainer();

      await request(app)
        .post("/trainer-schedule/working-hours")
        .set("Authorization", `Bearer ${token}`)
        .send({ dayOfWeek: 2, startTime: "09:00", endTime: "17:00" });

      const res = await request(app)
        .post("/trainer-schedule/working-hours")
        .set("Authorization", `Bearer ${token}`)
        .send({ dayOfWeek: 2, startTime: "10:00", endTime: "18:00" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.startTime).toBe("10:00");
    });

    it("should reject endTime before startTime", async () => {
      const { token } = await createTestTrainer();

      const res = await request(app)
        .post("/trainer-schedule/working-hours")
        .set("Authorization", `Bearer ${token}`)
        .send({ dayOfWeek: 3, startTime: "17:00", endTime: "09:00" });

      expect(res.status).toBe(400);
    });

    it("should get working hours", async () => {
      const { token } = await createTestTrainer();

      await request(app)
        .post("/trainer-schedule/working-hours")
        .set("Authorization", `Bearer ${token}`)
        .send({ dayOfWeek: 0, startTime: "08:00", endTime: "12:00" });

      const res = await request(app)
        .get("/trainer-schedule/working-hours")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("should reject non-trainer", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/trainer-schedule/working-hours")
        .set("Authorization", `Bearer ${token}`)
        .send({ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" });

      expect(res.status).toBe(403);
    });
  });

  describe("Slot generation & CRUD", () => {
    it("should generate slots from working hours", async () => {
      const { token } = await createTestTrainer();
      const from = futureDate(1);
      const to = futureDate(8);

      // Set working hours for every day
      for (let d = 0; d < 7; d++) {
        await request(app)
          .post("/trainer-schedule/working-hours")
          .set("Authorization", `Bearer ${token}`)
          .send({ dayOfWeek: d, startTime: "09:00", endTime: "12:00", slotDurationMin: 60 });
      }

      const res = await request(app)
        .post("/trainer-schedule/generate-slots")
        .set("Authorization", `Bearer ${token}`)
        .send({ fromDate: from, toDate: to });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBeGreaterThan(0);
    });

    it("should reject range > 62 days", async () => {
      const { token } = await createTestTrainer();

      const res = await request(app)
        .post("/trainer-schedule/generate-slots")
        .set("Authorization", `Bearer ${token}`)
        .send({ fromDate: futureDate(1), toDate: futureDate(100) });

      expect(res.status).toBe(400);
    });

    it("should get slots for date range", async () => {
      const { token } = await createTestTrainer();

      // Set up hours and generate
      await request(app)
        .post("/trainer-schedule/working-hours")
        .set("Authorization", `Bearer ${token}`)
        .send({ dayOfWeek: new Date(futureDate(1)).getDay(), startTime: "09:00", endTime: "11:00", slotDurationMin: 60 });

      await request(app)
        .post("/trainer-schedule/generate-slots")
        .set("Authorization", `Bearer ${token}`)
        .send({ fromDate: futureDate(1), toDate: futureDate(2) });

      const res = await request(app)
        .get("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${token}`)
        .query({ from: futureDate(1), to: futureDate(2) });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should create a one-off slot", async () => {
      const { token } = await createTestTrainer();
      const date = futureDate(3);

      const res = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${token}`)
        .send({
          date,
          startTime: "14:00",
          endTime: "15:00",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("should delete an available slot", async () => {
      const { token } = await createTestTrainer();
      const date = futureDate(4);

      const createRes = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${token}`)
        .send({ date, startTime: "14:00", endTime: "15:00" });

      const slotId = createRes.body.data.slot.id;

      const res = await request(app)
        .delete(`/trainer-schedule/slots/${slotId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Blocked dates", () => {
    it("should block a date", async () => {
      const { token } = await createTestTrainer();
      const date = futureDate(5);

      const res = await request(app)
        .post("/trainer-schedule/blocked-dates")
        .set("Authorization", `Bearer ${token}`)
        .send({ date, reason: "Personal day off" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should get blocked dates", async () => {
      const { token } = await createTestTrainer();
      const date = futureDate(6);

      await request(app)
        .post("/trainer-schedule/blocked-dates")
        .set("Authorization", `Bearer ${token}`)
        .send({ date });

      const res = await request(app)
        .get("/trainer-schedule/blocked-dates")
        .set("Authorization", `Bearer ${token}`)
        .query({ from: futureDate(5), to: futureDate(10) });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should unblock a date", async () => {
      const { token } = await createTestTrainer();
      const date = futureDate(7);

      await request(app)
        .post("/trainer-schedule/blocked-dates")
        .set("Authorization", `Bearer ${token}`)
        .send({ date });

      const res = await request(app)
        .delete(`/trainer-schedule/blocked-dates/${date}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject creating one-off slot on blocked date", async () => {
      const { token } = await createTestTrainer();
      const date = futureDate(8);

      await request(app)
        .post("/trainer-schedule/blocked-dates")
        .set("Authorization", `Bearer ${token}`)
        .send({ date });

      const res = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${token}`)
        .send({ date, startTime: "10:00", endTime: "11:00" });

      expect(res.status).toBe(409);
    });
  });

  describe("Day regeneration", () => {
    it("should regenerate slots for a day", async () => {
      const { token } = await createTestTrainer();
      const date = futureDate(9);
      const dayOfWeek = new Date(date).getDay();

      await request(app)
        .post("/trainer-schedule/working-hours")
        .set("Authorization", `Bearer ${token}`)
        .send({ dayOfWeek, startTime: "09:00", endTime: "12:00", slotDurationMin: 60 });

      await request(app)
        .post("/trainer-schedule/generate-slots")
        .set("Authorization", `Bearer ${token}`)
        .send({ fromDate: date, toDate: date });

      const res = await request(app)
        .post(`/trainer-schedule/days/${date}/regenerate`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("created");
    });

    it("should reject regenerating a blocked date", async () => {
      const { token } = await createTestTrainer();
      const date = futureDate(10);

      await request(app)
        .post("/trainer-schedule/blocked-dates")
        .set("Authorization", `Bearer ${token}`)
        .send({ date });

      const res = await request(app)
        .post(`/trainer-schedule/days/${date}/regenerate`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(409);
    });
  });

  describe("Client assignment", () => {
    it("should assign a client to a slot", async () => {
      const { token: trainerToken } = await createTestTrainer();
      const { user: client } = await createTestUser();
      const date = futureDate(11);

      const slotRes = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ date, startTime: "10:00", endTime: "11:00" });

      const slotId = slotRes.body.data.slot.id;

      const res = await request(app)
        .post(`/trainer-schedule/slots/${slotId}/assign-client`)
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ clientId: client.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject duplicate client on same day", async () => {
      const { token: trainerToken } = await createTestTrainer();
      const { user: client } = await createTestUser();
      const date = futureDate(12);

      const slot1Res = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ date, startTime: "10:00", endTime: "11:00" });

      const slot2Res = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ date, startTime: "11:00", endTime: "12:00" });

      await request(app)
        .post(`/trainer-schedule/slots/${slot1Res.body.data.slot.id}/assign-client`)
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ clientId: client.id });

      const res = await request(app)
        .post(`/trainer-schedule/slots/${slot2Res.body.data.slot.id}/assign-client`)
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ clientId: client.id });

      expect(res.status).toBe(409);
    });

    it("should unassign a client from slot (trainer)", async () => {
      const { token: trainerToken } = await createTestTrainer();
      const { user: client } = await createTestUser();
      const date = futureDate(13);

      const slotRes = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ date, startTime: "10:00", endTime: "11:00" });

      const slotId = slotRes.body.data.slot.id;

      await request(app)
        .post(`/trainer-schedule/slots/${slotId}/assign-client`)
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ clientId: client.id });

      const res = await request(app)
        .post(`/trainer-schedule/slots/${slotId}/unassign-client`)
        .set("Authorization", `Bearer ${trainerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject assigning to non-available slot", async () => {
      const { token: trainerToken } = await createTestTrainer();
      const { user: client1 } = await createTestUser();
      const { user: client2 } = await createTestUser();
      const date = futureDate(14);

      const slotRes = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ date, startTime: "10:00", endTime: "11:00" });

      const slotId = slotRes.body.data.slot.id;

      await request(app)
        .post(`/trainer-schedule/slots/${slotId}/assign-client`)
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ clientId: client1.id });

      const res = await request(app)
        .post(`/trainer-schedule/slots/${slotId}/assign-client`)
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ clientId: client2.id });

      expect(res.status).toBe(400);
    });
  });

  describe("Check-in code lifecycle", () => {
    it("should generate a check-in code (client)", async () => {
      const { token: clientToken } = await createTestUser();

      const res = await request(app)
        .post("/trainer-schedule/my-schedule/generate-check-in-code")
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toMatch(/^\d{6}$/);
      expect(res.body.data).toHaveProperty("expiresAt");
    });

    it("should get pending codes (trainer)", async () => {
      const { token: trainerToken } = await createTestTrainer();

      const res = await request(app)
        .get("/trainer-schedule/client-codes/pending")
        .set("Authorization", `Bearer ${trainerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should resolve a valid code", async () => {
      const { token: clientToken } = await createTestUser();
      const { token: trainerToken } = await createTestTrainer();

      const codeRes = await request(app)
        .post("/trainer-schedule/my-schedule/generate-check-in-code")
        .set("Authorization", `Bearer ${clientToken}`);

      const code = codeRes.body.data.code;

      const res = await request(app)
        .post("/trainer-schedule/client-codes/resolve")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ code });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("client");
    });

    it("should reject invalid code", async () => {
      const { token: trainerToken } = await createTestTrainer();

      const res = await request(app)
        .post("/trainer-schedule/client-codes/resolve")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ code: "000000" });

      expect([400, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it("should assign slot by code", async () => {
      const { token: trainerToken } = await createTestTrainer();
      const { token: clientToken } = await createTestUser();
      const date = futureDate(15);

      const slotRes = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ date, startTime: "10:00", endTime: "11:00" });

      const slotId = slotRes.body.data.slot.id;

      const codeRes = await request(app)
        .post("/trainer-schedule/my-schedule/generate-check-in-code")
        .set("Authorization", `Bearer ${clientToken}`);

      const code = codeRes.body.data.code;

      const res = await request(app)
        .post(`/trainer-schedule/slots/${slotId}/assign-by-code`)
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ code });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should assign slot by code ID", async () => {
      const { token: trainerToken } = await createTestTrainer();
      const { token: clientToken } = await createTestUser();
      const date = futureDate(16);

      const slotRes = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ date, startTime: "10:00", endTime: "11:00" });

      const slotId = slotRes.body.data.slot.id;

      const codeRes = await request(app)
        .post("/trainer-schedule/my-schedule/generate-check-in-code")
        .set("Authorization", `Bearer ${clientToken}`);

      const resolveRes = await request(app)
        .post("/trainer-schedule/client-codes/resolve")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ code: codeRes.body.data.code });

      const checkInCodeId = resolveRes.body.data.checkInCodeId;

      const res = await request(app)
        .post(`/trainer-schedule/slots/${slotId}/assign-by-code-id`)
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ checkInCodeId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject check-in on available slot", async () => {
      const { token: trainerToken } = await createTestTrainer();
      const date = futureDate(17);

      const slotRes = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ date, startTime: "10:00", endTime: "11:00" });

      const slotId = slotRes.body.data.slot.id;

      const res = await request(app)
        .post(`/trainer-schedule/slots/${slotId}/check-in`)
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ code: "123456" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject check-in without code on assigned slot", async () => {
      const { token: trainerToken } = await createTestTrainer();
      const { user: client } = await createTestUser();
      const date = futureDate(18);

      const slotRes = await request(app)
        .post("/trainer-schedule/slots")
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ date, startTime: "10:00", endTime: "11:00" });

      const slotId = slotRes.body.data.slot.id;

      await request(app)
        .post(`/trainer-schedule/slots/${slotId}/assign-client`)
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ clientId: client.id });

      const res = await request(app)
        .post(`/trainer-schedule/slots/${slotId}/check-in`)
        .set("Authorization", `Bearer ${trainerToken}`)
        .send({ code: "123456" });

      expect(res.status).toBe(400);
    });
  });

  describe("Client schedule & search", () => {
    it("should get client schedule", async () => {
      const { token: clientToken } = await createTestUser();

      const res = await request(app)
        .get("/trainer-schedule/my-schedule")
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should search clients by name", async () => {
      const { token: trainerToken } = await createTestTrainer();
      await createTestUser({ firstName: "SearchableClient", lastName: "TestUser" });

      const res = await request(app)
        .get("/trainer-schedule/clients/search")
        .set("Authorization", `Bearer ${trainerToken}`)
        .query({ q: "SearchableClient" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should reject search with too short query", async () => {
      const { token: trainerToken } = await createTestTrainer();

      const res = await request(app)
        .get("/trainer-schedule/clients/search")
        .set("Authorization", `Bearer ${trainerToken}`)
        .query({ q: "A" });

      expect(res.status).toBe(400);
    });
  });
});
