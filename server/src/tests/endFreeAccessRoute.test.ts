import "./withDatabase";
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestAdmin, createTestTrainer, createTestUser } from "./helpers";
import { subStatus } from "../services/billing/types";

/**
 * Access control and input handling for the admin "converted" step. The
 * RevenueCat side is covered in freeAccess.test.ts; nothing here reaches it.
 */
const endFor = (trainerId: number | string) =>
  request(app).post(`/billing/admin/trainers/${trainerId}/end-free-access`);

describe("POST /billing/admin/trainers/:trainerId/end-free-access", () => {
  it("requires authentication", async () => {
    const res = await endFor(1).send({ noticeDays: 0 });
    expect(res.status).toBe(401);
  });

  it("is admin-only", async () => {
    const { token } = await createTestUser({ role: "client" });
    const { trainer } = await createTestTrainer();

    const res = await endFor(trainer.id)
      .set("Authorization", `Bearer ${token}`)
      .send({ noticeDays: 0 });

    expect(res.status).toBe(403);
  });

  it("does not let a trainer end free access, theirs or anyone's", async () => {
    const { token, trainer } = await createTestTrainer();

    const res = await endFor(trainer.id)
      .set("Authorization", `Bearer ${token}`)
      .send({ noticeDays: 0 });

    expect(res.status).toBe(403);
  });

  it("answers 404 for an unknown trainer", async () => {
    const { token } = await createTestAdmin();

    const res = await endFor(999999)
      .set("Authorization", `Bearer ${token}`)
      .send({ noticeDays: 0 });

    expect(res.status).toBe(404);
  });

  it("rejects a notice period outside 0-90 days", async () => {
    const { token } = await createTestAdmin();
    const { trainer } = await createTestTrainer();

    for (const noticeDays of [-1, 91, 2.5, "soon"]) {
      const res = await endFor(trainer.id)
        .set("Authorization", `Bearer ${token}`)
        .send({ noticeDays });
      expect(res.status).toBe(400);
    }
  });

  it("answers 409 when the trainer has no running free access", async () => {
    const { token } = await createTestAdmin();
    const { trainer } = await createTestTrainer();
    await trainer.update({ trialEndsAt: new Date(Date.now() - 1000), subscriptionStatus: subStatus.TRIAL });

    const res = await endFor(trainer.id)
      .set("Authorization", `Bearer ${token}`)
      .send({ noticeDays: 0 });

    expect(res.status).toBe(409);
  });
});
