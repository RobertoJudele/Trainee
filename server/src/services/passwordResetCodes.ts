import crypto from "crypto";
import { Op } from "sequelize";
import { PasswordResetCode } from "../models/passwordResetCode";
import { getOptionalEnv, getRequiredEnv } from "../config/env";

/**
 * 6-digit password reset codes. A code is short enough to type from an email
 * into the app; what keeps it from being guessed is the server, not its length:
 * it expires, it is single-use, and it locks after MAX_ATTEMPTS wrong guesses.
 */

export const CODE_TTL_MS = 15 * 60_000;
export const MAX_ATTEMPTS = 5;
/** A new code (and email) at most this often per user. */
export const RESEND_COOLDOWN_MS = 60_000;

/**
 * Only an HMAC is stored, keyed by a server secret, so a database leak does
 * not hand over live codes: a plain hash of 6 digits is reversed instantly.
 */
const hashCode = (code: string): string =>
  crypto
    .createHmac("sha256", getOptionalEnv("JWT_RESET_SECRET") || getRequiredEnv("JWT_SECRET"))
    .update(code)
    .digest("hex");

const generateCode = (): string => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

/**
 * Issues a new code for the user and retires any earlier one. Returns null
 * inside the resend cooldown, in which case no email should go out.
 */
export const issueResetCode = async (userId: number): Promise<string | null> => {
  const latest = await PasswordResetCode.findOne({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return null;
  }

  await PasswordResetCode.update(
    { consumedAt: new Date() },
    { where: { userId, consumedAt: null } }
  );

  const code = generateCode();
  await PasswordResetCode.create({
    userId,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return code;
};

export type ResetCodeCheck = "ok" | "invalid" | "expired" | "locked";

/**
 * Checks a typed code against the user's live code and, if it matches, burns
 * it. A wrong guess counts against the code; at MAX_ATTEMPTS it is dead and the
 * user has to ask for a new one.
 */
export const consumeResetCode = async (userId: number, code: string): Promise<ResetCodeCheck> => {
  const live = await PasswordResetCode.findOne({
    where: { userId, consumedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [["createdAt", "DESC"]],
  });
  if (!live) return "expired";
  if (live.attempts >= MAX_ATTEMPTS) return "locked";

  const expected = Buffer.from(live.codeHash, "hex");
  const given = Buffer.from(hashCode(code.trim()), "hex");
  if (!crypto.timingSafeEqual(expected, given)) {
    // Read before incrementing: increment() also bumps the in-memory value.
    const attemptsSoFar = live.attempts + 1;
    await live.increment("attempts");
    return attemptsSoFar >= MAX_ATTEMPTS ? "locked" : "invalid";
  }

  // Conditional update: two requests racing with the right code can't both win.
  const [affected] = await PasswordResetCode.update(
    { consumedAt: new Date() },
    { where: { id: live.id, consumedAt: null } }
  );
  return affected > 0 ? "ok" : "expired";
};
