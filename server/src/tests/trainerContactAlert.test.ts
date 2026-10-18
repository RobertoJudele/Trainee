import "./withDatabase";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { emailService } from "../services/emailService";
import { TrainerContactEvent } from "../models/trainerContactEvent";
import { resetTrainerContactRateLimit } from "../services/trainerContactAlerts";
import { createTestTrainer, createTestUser } from "./helpers";

const ALERT_TO = "alerts@salvio.test";

const tap = (trainerId: string | number, token?: string, channel = "whatsapp", ip = "10.1.1.1") => {
  const req = request(app)
    .post(`/trainer/${trainerId}/contact`)
    .set("X-Forwarded-For", ip)
    .send({ channel });
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

const tapByNewPeople = async (trainerId: number, count: number) => {
  for (let i = 0; i < count; i += 1) {
    const { token } = await createTestUser();
    expect((await tap(trainerId, token)).status).toBe(204);
  }
};

describe("POST /trainer/:trainerId/contact", () => {
  let sendEmail: jest.SpiedFunction<typeof emailService.sendEmail>;

  beforeEach(() => {
    process.env.CONTACT_ALERT_EMAIL = ALERT_TO;
    resetTrainerContactRateLimit();
    sendEmail = jest.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
  });

  afterEach(() => {
    sendEmail.mockRestore();
    delete process.env.CONTACT_ALERT_EMAIL;
  });

  it("records each tap with its channel", async () => {
    const { trainer } = await createTestTrainer();
    const { user, token } = await createTestUser();

    expect((await tap(trainer.id, token, "instagram")).status).toBe(204);

    const events = await TrainerContactEvent.findAll({ where: { trainerId: trainer.id } });
    expect(events).toHaveLength(1);
    expect(events[0].channel).toBe("instagram");
    expect(events[0].contactUserId).toBe(user.id);
  });

  it("accepts the trainer's public id as well as the numeric one", async () => {
    const { trainer } = await createTestTrainer();
    await trainer.reload();

    expect((await tap(trainer.publicId!)).status).toBe(204);
    expect(await TrainerContactEvent.count({ where: { trainerId: trainer.id } })).toBe(1);
  });

  it("emails once when the fifth different person taps", async () => {
    const { trainer, user: trainerUser } = await createTestTrainer({ firstName: "Andrei", lastName: "Pop" });

    await tapByNewPeople(trainer.id, 4);
    expect(sendEmail).not.toHaveBeenCalled();

    await tapByNewPeople(trainer.id, 1);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe(ALERT_TO);
    expect(mail.subject).toContain("Andrei Pop");
    expect(mail.subject).toContain("5 persoane");
    expect(mail.text).toContain(trainerUser.email);

    await trainer.reload();
    expect(trainer.contactAlertSentAt).toBeTruthy();
  });

  it("does not email again after the alert has gone out", async () => {
    const { trainer } = await createTestTrainer();

    await tapByNewPeople(trainer.id, 7);

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("counts the same person once, however often they tap", async () => {
    const { trainer } = await createTestTrainer();
    const { token } = await createTestUser();

    for (const channel of ["whatsapp", "instagram", "facebook", "whatsapp", "whatsapp"]) {
      await tap(trainer.id, token, channel);
    }

    expect(await TrainerContactEvent.count({ where: { trainerId: trainer.id } })).toBe(5);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("counts logged-out visitors by IP", async () => {
    const { trainer } = await createTestTrainer();

    for (let i = 0; i < 5; i += 1) {
      await tap(trainer.id, undefined, "whatsapp", `10.2.0.${i}`);
    }

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("ignores a trainer tapping their own buttons", async () => {
    const { trainer, token } = await createTestTrainer();

    expect((await tap(trainer.id, token)).status).toBe(204);
    expect(await TrainerContactEvent.count({ where: { trainerId: trainer.id } })).toBe(0);
  });

  it("holds the alert until CONTACT_ALERT_EMAIL is set, then sends it", async () => {
    delete process.env.CONTACT_ALERT_EMAIL;
    const { trainer } = await createTestTrainer();

    await tapByNewPeople(trainer.id, 5);
    expect(sendEmail).not.toHaveBeenCalled();
    await trainer.reload();
    expect(trainer.contactAlertSentAt).toBeNull();

    process.env.CONTACT_ALERT_EMAIL = ALERT_TO;
    await tapByNewPeople(trainer.id, 1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("retries on the next tap when the email fails", async () => {
    const { trainer } = await createTestTrainer();
    sendEmail.mockRejectedValueOnce(new Error("smtp down"));

    await tapByNewPeople(trainer.id, 5);
    await trainer.reload();
    expect(trainer.contactAlertSentAt).toBeNull();

    await tapByNewPeople(trainer.id, 1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    await trainer.reload();
    expect(trainer.contactAlertSentAt).toBeTruthy();
  });

  it("rejects an unknown channel and an unknown trainer", async () => {
    const { trainer } = await createTestTrainer();

    expect((await tap(trainer.id, undefined, "telegram")).status).toBe(400);
    expect((await tap(999999)).status).toBe(404);
  });
});
