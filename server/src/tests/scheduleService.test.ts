// Boundary tests for the guarantees the services/schedule extraction added.
// The pure rules are covered in scheduleDomain.test.ts; these drive the real
// HTTP stack, because each case below is one the old controller answered
// wrongly and a unit test on a fake could not have caught.
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestTrainer, createTestUser } from "./helpers";
import { ClientSessionPack } from "../models/clientSessionPack";
import { TrainerClient } from "../models/trainerClient";
import { TrainerScheduleSlot } from "../models/trainerScheduleSlot";

const dateKey = (daysFromNow: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
};

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A trainer with one 09:00-17:00 day generated at `slotDurationMin`. */
async function trainerWithDay(dateStr: string, slotDurationMin = 60) {
  const { token, trainer } = await createTestTrainer();
  const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();

  await request(app)
    .post("/trainer-schedule/working-hours")
    .set(auth(token))
    .send({ dayOfWeek: weekday, startTime: "09:00", endTime: "17:00", slotDurationMin })
    .expect(201);

  await request(app)
    .post("/trainer-schedule/generate-slots")
    .set(auth(token))
    .send({ fromDate: dateStr, toDate: dateStr, timeZone: "UTC" })
    .expect(201);

  const slots = await request(app)
    .get(`/trainer-schedule/slots?from=${dateStr}&to=${dateStr}&timeZone=UTC`)
    .set(auth(token))
    .expect(200);

  return { token, trainer, slots: slots.body.data as Array<Record<string, any>> };
}

describe("Schedule service boundary", () => {
  describe("regenerating a day at a new duration", () => {
    // The bug: regenerateDay compared exact start instants instead of
    // intervals, so regenerating a booked day at 30-minute slots planted a
    // free 09:30-10:00 slot inside the booked 09:00-10:00 one. Both then
    // showed in the planner and either could be booked.
    it("never creates a slot overlapping a booked one", async () => {
      const day = dateKey(3);
      const { token, slots } = await trainerWithDay(day, 60);
      const { user: client } = await createTestUser({ role: "client" });

      const first = slots.find((s) => s.status === "available");
      expect(first).toBeDefined();

      await request(app)
        .post(`/trainer-schedule/slots/${first!.id}/assign-client`)
        .set(auth(token))
        .send({ clientId: client.id })
        .expect(200);

      await request(app)
        .post(`/trainer-schedule/days/${day}/regenerate`)
        .set(auth(token))
        .send({ startTime: "09:00", endTime: "17:00", slotDurationMin: 30, timeZone: "UTC" })
        .expect(200);

      const after = await request(app)
        .get(`/trainer-schedule/slots?from=${day}&to=${day}&timeZone=UTC`)
        .set(auth(token))
        .expect(200);

      const booked = (after.body.data as Array<Record<string, any>>).filter(
        (s) => s.status === "assigned"
      );
      expect(booked).toHaveLength(1);

      const bookedStart = new Date(booked[0].startsAt).getTime();
      const bookedEnd = new Date(booked[0].endsAt).getTime();
      const overlapping = (after.body.data as Array<Record<string, any>>).filter((s) => {
        if (s.id === booked[0].id) return false;
        return new Date(s.startsAt).getTime() < bookedEnd &&
          new Date(s.endsAt).getTime() > bookedStart;
      });

      expect(overlapping).toEqual([]);
    });
  });

  describe("booking atomicity", () => {
    // Slot, roster row and pack consumption used to be three separate commits.
    it("commits the roster row and the pack consumption with the booking", async () => {
      const day = dateKey(4);
      const { token, trainer, slots } = await trainerWithDay(day);
      const { user: client } = await createTestUser({ role: "client" });

      const pack = await ClientSessionPack.create({
        trainerId: trainer.id,
        clientId: client.id,
        totalSessions: 5,
        usedSessions: 0,
      });

      const slot = slots.find((s) => s.status === "available")!;
      await request(app)
        .post(`/trainer-schedule/slots/${slot.id}/assign-client`)
        .set(auth(token))
        .send({ clientId: client.id })
        .expect(200);

      const roster = await TrainerClient.findOne({
        where: { trainerId: trainer.id, clientId: client.id },
      });
      expect(roster).not.toBeNull();
      await pack.reload();
      expect(pack.usedSessions).toBe(1);
    });

    it("refuses to consume past a pack's own total instead of over-counting it", async () => {
      const day = dateKey(5);
      const { token, trainer, slots } = await trainerWithDay(day);
      const { user: client } = await createTestUser({ role: "client" });

      // Already exhausted. The old path called increment("usedSessions") with
      // no ceiling, so this became 3 of 2.
      const pack = await ClientSessionPack.create({
        trainerId: trainer.id,
        clientId: client.id,
        totalSessions: 2,
        usedSessions: 2,
      });

      const slot = slots.find((s) => s.status === "available")!;
      const res = await request(app)
        .post(`/trainer-schedule/slots/${slot.id}/assign-client`)
        .set(auth(token))
        .send({ clientId: client.id })
        .expect(200);

      expect(res.body.data.warnings).toContain("PACK_EXHAUSTED");
      await pack.reload();
      expect(pack.usedSessions).toBe(2);
    });
  });

  describe("releasing a booking", () => {
    it("lets the booked client cancel and refunds their pack", async () => {
      const day = dateKey(6);
      const { token, trainer, slots } = await trainerWithDay(day);
      const { user: client, token: clientToken } = await createTestUser({ role: "client" });

      const pack = await ClientSessionPack.create({
        trainerId: trainer.id,
        clientId: client.id,
        totalSessions: 5,
        usedSessions: 0,
      });

      const slot = slots.find((s) => s.status === "available")!;
      await request(app)
        .post(`/trainer-schedule/slots/${slot.id}/assign-client`)
        .set(auth(token))
        .send({ clientId: client.id })
        .expect(200);

      const res = await request(app)
        .post(`/trainer-schedule/slots/${slot.id}/unassign-client`)
        .set(auth(clientToken))
        .expect(200);

      expect(res.body.data.slot.status).toBe("available");
      await pack.reload();
      expect(pack.usedSessions).toBe(0);
    });

    it("does not let a client cancel someone else's booking", async () => {
      const day = dateKey(7);
      const { token, slots } = await trainerWithDay(day);
      const { user: booked } = await createTestUser({ role: "client" });
      const { token: outsiderToken } = await createTestUser({ role: "client" });

      const slot = slots.find((s) => s.status === "available")!;
      await request(app)
        .post(`/trainer-schedule/slots/${slot.id}/assign-client`)
        .set(auth(token))
        .send({ clientId: booked.id })
        .expect(200);

      await request(app)
        .post(`/trainer-schedule/slots/${slot.id}/unassign-client`)
        .set(auth(outsiderToken))
        .expect(404);

      const row = await TrainerScheduleSlot.findByPk(slot.id);
      expect(row!.clientId).toBe(booked.id);
    });
  });

  describe("slot writes are trainer-scoped", () => {
    it("refuses to delete another trainer's slot", async () => {
      const { slots } = await trainerWithDay(dateKey(8));
      const { token: otherToken } = await createTestTrainer();

      const slot = slots.find((s) => s.status === "available")!;
      await request(app)
        .delete(`/trainer-schedule/slots/${slot.id}`)
        .set(auth(otherToken))
        .expect(404);

      expect(await TrainerScheduleSlot.findByPk(slot.id)).not.toBeNull();
    });
  });

  describe("blocking a day", () => {
    it("reports the conflicting bookings and blocks nothing", async () => {
      const day = dateKey(9);
      const { token, slots } = await trainerWithDay(day);
      const { user: client } = await createTestUser({ role: "client" });

      const slot = slots.find((s) => s.status === "available")!;
      await request(app)
        .post(`/trainer-schedule/slots/${slot.id}/assign-client`)
        .set(auth(token))
        .send({ clientId: client.id })
        .expect(200);

      const res = await request(app)
        .post("/trainer-schedule/blocked-dates")
        .set(auth(token))
        .send({ date: day, timeZone: "UTC" })
        .expect(409);

      expect(res.body.conflicts).toHaveLength(1);
      expect(res.body.conflicts[0].client.id).toBe(client.id);

      const blocked = await request(app)
        .get(`/trainer-schedule/blocked-dates?from=${day}&to=${day}`)
        .set(auth(token))
        .expect(200);
      expect(blocked.body.data).toEqual([]);
    });
  });

  describe("resolving an assign code", () => {
    it("identifies the client without rostering them", async () => {
      const { token: trainerToken, trainer } = await createTestTrainer();
      const { user: client, token: clientToken } = await createTestUser({ role: "client" });

      const issued = await request(app)
        .post("/trainer-schedule/my-schedule/generate-check-in-code")
        .set(auth(clientToken))
        .expect(200);

      const res = await request(app)
        .post("/trainer-schedule/client-codes/resolve")
        .set(auth(trainerToken))
        .send({ code: issued.body.data.code })
        .expect(200);

      expect(res.body.data.client.id).toBe(client.id);

      // The old handler wrote a roster row here, which is the only thing
      // review.ts checks - so typing a code and never booking granted a
      // review. Resolution is a lookup now.
      const roster = await TrainerClient.findOne({
        where: { trainerId: trainer.id, clientId: client.id },
      });
      expect(roster).toBeNull();
    });

    it("rejects a superseded code", async () => {
      const { token: trainerToken } = await createTestTrainer();
      const { token: clientToken } = await createTestUser({ role: "client" });

      const first = await request(app)
        .post("/trainer-schedule/my-schedule/generate-check-in-code")
        .set(auth(clientToken))
        .expect(200);
      await request(app)
        .post("/trainer-schedule/my-schedule/generate-check-in-code")
        .set(auth(clientToken))
        .expect(200);

      await request(app)
        .post("/trainer-schedule/client-codes/resolve")
        .set(auth(trainerToken))
        .send({ code: first.body.data.code })
        .expect(400);
    });
  });
});
