import "./withDatabase";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import sequelize from "../db";
import { emailService } from "../services/emailService";
import { PasswordResetCode } from "../models/passwordResetCode";
import { RefreshToken } from "../models/refreshToken";
import { createTestUser } from "./helpers";

const NEW_PASSWORD = "NewPass123";

describe("password reset by 6-digit code", () => {
  let sendEmail: jest.SpiedFunction<typeof emailService.sendEmail>;

  beforeEach(() => {
    sendEmail = jest.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
  });

  afterEach(() => {
    sendEmail.mockRestore();
  });

  /** The send is fire-and-forget; let it run before reading the mock. */
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  const requestCode = async (email: string): Promise<string | null> => {
    sendEmail.mockClear();
    const res = await request(app).post("/auth/forgot-password").send({ email });
    expect(res.status).toBe(200);
    await flush();
    if (sendEmail.mock.calls.length === 0) return null;
    const match = sendEmail.mock.calls[0][0].text.match(/\b(\d{6})\b/);
    return match ? match[1] : null;
  };

  const reset = (email: string, code: string, newPassword = NEW_PASSWORD) =>
    request(app).post("/auth/reset-password").send({ email, code, newPassword });

  /** Codes are rate-limited per user; age the latest one past the cooldown. */
  // Raw SQL: Sequelize won't write createdAt through Model.update.
  const skipCooldown = (userId: number) =>
    sequelize.query(
      "UPDATE password_reset_codes SET created_at = NOW() - INTERVAL '2 minutes' WHERE user_id = :userId",
      { replacements: { userId } }
    );

  it("emails a 6-digit code in Romanian", async () => {
    const { user } = await createTestUser();

    const code = await requestCode(user.email);

    expect(code).toMatch(/^\d{6}$/);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe(user.email);
    expect(mail.subject).toContain(code!);
    expect(mail.text).toContain("15 minute");
  });

  it("answers an unknown email the same way and sends nothing", async () => {
    const code = await requestCode("nobody-here@test.com");

    expect(code).toBeNull();
  });

  it("does not send a second code within the cooldown", async () => {
    const { user } = await createTestUser();

    await requestCode(user.email);
    const second = await requestCode(user.email);

    expect(second).toBeNull();
    expect(await PasswordResetCode.count({ where: { userId: user.id } })).toBe(1);
  });

  it("resets the password with the right code and signs out every session", async () => {
    const { user } = await createTestUser();
    const login = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: "Test123!" });
    expect(login.status).toBe(201);

    const code = await requestCode(user.email);
    const res = await reset(user.email, code!);

    expect(res.status).toBe(200);
    expect(
      (await request(app).post("/auth/login").send({ email: user.email, password: NEW_PASSWORD }))
        .status
    ).toBe(201);
    expect(
      (await request(app).post("/auth/login").send({ email: user.email, password: "Test123!" }))
        .status
    ).toBe(401);
    expect(
      await RefreshToken.count({ where: { userId: user.id, isRevoked: false } })
    ).toBe(1); // only the session from the login with the new password
  });

  it("works only once", async () => {
    const { user } = await createTestUser();
    const code = await requestCode(user.email);

    expect((await reset(user.email, code!)).status).toBe(200);
    const again = await reset(user.email, code!, "Another123");

    expect(again.status).toBe(400);
    expect(again.body.code).toBe("RESET_CODE_EXPIRED");
  });

  it("rejects a wrong code and locks it after 5 wrong tries", async () => {
    const { user } = await createTestUser();
    const code = await requestCode(user.email);
    const wrong = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < 4; i += 1) {
      const res = await reset(user.email, wrong);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("RESET_CODE_INVALID");
    }
    expect((await reset(user.email, wrong)).body.code).toBe("RESET_CODE_LOCKED");

    // Even the right code is dead now.
    const right = await reset(user.email, code!);
    expect(right.status).toBe(400);
    expect(right.body.code).toBe("RESET_CODE_LOCKED");
  });

  it("rejects an expired code", async () => {
    const { user } = await createTestUser();
    const code = await requestCode(user.email);
    await PasswordResetCode.update(
      { expiresAt: new Date(Date.now() - 1000) },
      { where: { userId: user.id } }
    );

    const res = await reset(user.email, code!);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("RESET_CODE_EXPIRED");
  });

  it("retires the old code when a new one is issued", async () => {
    const { user } = await createTestUser();
    const first = await requestCode(user.email);
    await skipCooldown(user.id);
    const second = await requestCode(user.email);

    expect(second).toMatch(/^\d{6}$/);
    if (first !== second) {
      expect((await reset(user.email, first!)).status).toBe(400);
    }
    expect((await reset(user.email, second!)).status).toBe(200);
  });

  it("answers an unknown email like an expired code", async () => {
    const res = await reset("nobody-here@test.com", "123456");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("RESET_CODE_EXPIRED");
  });

  it("rejects a code that is not 6 digits", async () => {
    const { user } = await createTestUser();

    expect((await reset(user.email, "12345")).status).toBe(400);
    expect((await reset(user.email, "abcdef")).status).toBe(400);
  });

  it("never stores the code itself", async () => {
    const { user } = await createTestUser();
    const code = await requestCode(user.email);

    const row = await PasswordResetCode.findOne({ where: { userId: user.id } });
    expect(row!.codeHash).not.toContain(code!);
    expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
