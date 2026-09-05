import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import request from "supertest";

// The ID-token verification itself is covered end to end in
// socialAuthVerify.test.ts against a real key. Here it is stubbed so these tests
// can drive the account-linking and signup-completion logic without a network
// call to Google or Apple.
jest.mock("../services/socialAuth", () => {
  const actual =
    jest.requireActual<typeof import("../services/socialAuth")>(
      "../services/socialAuth"
    );
  return { ...actual, verifySocialIdToken: jest.fn() };
});

import { app } from "../index";
import { User } from "../models/user";
import {
  SocialAuthError,
  verifySocialIdToken,
  type SocialIdentity,
  type SocialProvider,
} from "../services/socialAuth";
import { generateToken } from "../utils/jwt";
import { UserRole } from "../types/common";

const mockedVerify = verifySocialIdToken as jest.MockedFunction<
  typeof verifySocialIdToken
>;

let seq = 0;
const unique = (): string => `${Date.now()}${(seq += 1)}`;

const identity = (over: Partial<SocialIdentity> = {}): SocialIdentity => {
  const n = unique();
  return {
    provider: "google",
    providerId: `sub-${n}`,
    email: `social${n}@test.com`,
    emailVerified: true,
    firstName: "Ana",
    lastName: "Popescu",
    ...over,
  };
};

/** Drive step 1 with a stubbed provider response. */
const socialSignIn = (
  who: SocialIdentity,
  body: Record<string, unknown> = {}
) => {
  mockedVerify.mockResolvedValueOnce(who);
  return request(app)
    .post("/auth/social")
    .send({ provider: who.provider, idToken: "stub-token", ...body });
};

const completeSignup = (
  pendingToken: string,
  over: Record<string, unknown> = {}
) =>
  request(app)
    .post("/auth/social/complete")
    .send({
      pendingToken,
      firstName: "Ana",
      lastName: "Popescu",
      phone: "0712345678",
      ...over,
    });

/** Register a normal password account. */
const registerPasswordUser = (email: string, password = "Test123!") =>
  request(app).post("/auth/register").send({
    email,
    password,
    firstName: "Existing",
    lastName: "User",
    phone: "0712345678",
  });

beforeEach(() => {
  mockedVerify.mockReset();
});

describe("Social sign-in", () => {
  describe("POST /auth/social - first time", () => {
    it("asks for a profile instead of creating a half-built account", async () => {
      const who = identity();

      const res = await socialSignIn(who);

      expect(res.status).toBe(200);
      expect(res.body.data.needsProfile).toBe(true);
      expect(typeof res.body.data.pendingToken).toBe("string");
      expect(res.body.data.email).toBe(who.email);
      // No token yet: the user is not signed in until the phone is supplied.
      expect(res.body.data.token).toBeUndefined();
      // Crucially, nothing was written - phone is mandatory in Salvio and a row
      // without one would be a half-user every other screen has to cope with.
      expect(await User.findOne({ where: { email: who.email } })).toBeNull();
    });

    it("passes the provider's name through for prefilling", async () => {
      const res = await socialSignIn(
        identity({ firstName: "Mihai", lastName: "Ionescu" })
      );

      expect(res.body.data.firstName).toBe("Mihai");
      expect(res.body.data.lastName).toBe("Ionescu");
    });

    // Apple never puts the name in the token; it hands it to the client on the
    // first authorization only, so the client posts it up alongside.
    it("falls back to the name sent by the client when Apple omits it", async () => {
      const who = identity({
        provider: "apple",
        firstName: undefined,
        lastName: undefined,
      });

      const res = await socialSignIn(who, {
        firstName: "Elena",
        lastName: "Radu",
      });

      expect(res.body.data.firstName).toBe("Elena");
      expect(res.body.data.lastName).toBe("Radu");
    });

    it("rejects an unknown provider", async () => {
      const res = await request(app)
        .post("/auth/social")
        .send({ provider: "facebook", idToken: "stub" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects a missing token", async () => {
      const res = await request(app)
        .post("/auth/social")
        .send({ provider: "google" });

      expect(res.status).toBe(400);
    });

    it("returns 401 when the provider rejects the token", async () => {
      mockedVerify.mockRejectedValueOnce(
        new SocialAuthError("Invalid google token: signature verification failed")
      );

      const res = await request(app)
        .post("/auth/social")
        .send({ provider: "google", idToken: "forged" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("does not leak internals when verification blows up unexpectedly", async () => {
      mockedVerify.mockRejectedValueOnce(new Error("ECONNRESET"));

      const res = await request(app)
        .post("/auth/social")
        .send({ provider: "google", idToken: "stub" });

      expect(res.status).toBe(500);
      expect(res.body.message).not.toContain("ECONNRESET");
    });
  });

  describe("POST /auth/social/complete", () => {
    it("creates a passwordless account and signs the user in", async () => {
      const who = identity();
      const { body } = await socialSignIn(who);

      const res = await completeSignup(body.data.pendingToken, {
        firstName: "Ana",
        lastName: "Popescu",
        phone: "0712345678",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();

      const saved = await User.scope("withPassword").findOne({
        where: { email: who.email },
      });
      expect(saved).not.toBeNull();
      expect(saved!.googleId).toBe(who.providerId);
      expect(saved!.phone).toBe("0712345678");
      expect(saved!.role).toBe(UserRole.CLIENT);
      // No password at all - not a random one nobody can use.
      expect(saved!.password ?? null).toBeNull();
      // The provider already proved the address, so no verification email is owed.
      expect(saved!.isVerified).toBe(true);
      expect(saved!.emailVerifiedAt).toBeTruthy();
    });

    it("stores the Apple id on the apple column, not the Google one", async () => {
      const who = identity({ provider: "apple" });
      const { body } = await socialSignIn(who, {
        firstName: "Elena",
        lastName: "Radu",
      });

      await completeSignup(body.data.pendingToken);

      const saved = await User.findOne({ where: { email: who.email } });
      expect(saved!.appleId).toBe(who.providerId);
      expect(saved!.googleId ?? null).toBeNull();
    });

    // Phone stays mandatory and Romanian-only for social signups too.
    it.each([
      ["a blank phone", ""],
      ["a non-Romanian number", "+14155552671"],
      ["a landline", "0212345678"],
    ])("rejects %s", async (_label, phone) => {
      const { body } = await socialSignIn(identity());

      const res = await completeSignup(body.data.pendingToken, { phone });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("names the expected phone format in the error", async () => {
      const { body } = await socialSignIn(identity());

      const res = await completeSignup(body.data.pendingToken, {
        phone: "+14155552671",
      });

      expect(JSON.stringify(res.body)).toContain("0712 345 678");
    });

    it("rejects a too-short name", async () => {
      const { body } = await socialSignIn(identity());

      const res = await completeSignup(body.data.pendingToken, {
        firstName: "A",
      });

      expect(res.status).toBe(400);
    });

    // The identity comes from the signed token, so a stale one cannot be
    // replayed to make a second account for the same person.
    it("rejects a pendingToken that was already used", async () => {
      const who = identity();
      const { body } = await socialSignIn(who);

      const first = await completeSignup(body.data.pendingToken);
      expect(first.status).toBe(201);

      const second = await completeSignup(body.data.pendingToken);
      expect(second.status).toBe(409);
    });

    it("rejects a garbage pendingToken", async () => {
      const res = await completeSignup("not-a-jwt");
      expect(res.status).toBe(401);
    });

    // Access tokens are signed with the same secret; only `purpose` separates
    // them. Without that check any logged-in user could forge a signup.
    it("rejects an access token used as a pendingToken", async () => {
      const accessToken = generateToken({
        userId: 1,
        email: "someone@test.com",
        role: UserRole.CLIENT,
      });

      const res = await completeSignup(accessToken);

      expect(res.status).toBe(401);
    });

    // The mirror image: a pendingToken carries no userId and must not open an
    // authenticated route.
    it("does not accept a pendingToken as an access token", async () => {
      const { body } = await socialSignIn(identity());

      const res = await request(app)
        .get("/auth/profile")
        .set("Authorization", `Bearer ${body.data.pendingToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe("returning users", () => {
    it("signs a linked account straight in, with no profile step", async () => {
      const who = identity();
      const first = await socialSignIn(who);
      await completeSignup(first.body.data.pendingToken);

      const res = await socialSignIn(who);

      expect(res.status).toBe(200);
      expect(res.body.data.needsProfile).toBeUndefined();
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(who.email);
    });

    it("recognises the user even after they change their provider email", async () => {
      const who = identity();
      const first = await socialSignIn(who);
      await completeSignup(first.body.data.pendingToken);

      // Same `sub`, new address: the provider id is what identifies the user.
      const res = await socialSignIn({
        ...who,
        email: `changed${unique()}@test.com`,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(who.email);
    });
  });

  describe("linking to an existing password account", () => {
    it("links by verified email and keeps the password working", async () => {
      const email = `link${unique()}@test.com`;
      await registerPasswordUser(email);

      const res = await socialSignIn(identity({ email, emailVerified: true }));

      expect(res.status).toBe(200);
      expect(res.body.data.needsProfile).toBeUndefined();
      expect(res.body.data.token).toBeDefined();

      const linked = await User.findOne({ where: { email } });
      expect(linked!.googleId).toBeTruthy();

      // Linking must not cost the user their existing way in.
      const passwordLogin = await request(app)
        .post("/auth/login")
        .send({ email, password: "Test123!" });
      expect(passwordLogin.status).toBe(201);
    });

    // An unverified email claim is just a string the caller controls. Trusting
    // it would hand over any account whose address an attacker can guess.
    it("refuses to link when the provider has not verified the email", async () => {
      const email = `unverified${unique()}@test.com`;
      await registerPasswordUser(email);

      const res = await socialSignIn(identity({ email, emailVerified: false }));

      expect(res.status).toBe(200);
      expect(res.body.data.needsProfile).toBe(true);

      const untouched = await User.findOne({ where: { email } });
      expect(untouched!.googleId ?? null).toBeNull();
    });

    it("reports a conflict if completion is attempted for a taken email", async () => {
      const who = identity({ emailVerified: false });
      const { body } = await socialSignIn(who);

      // Someone registers that address with a password in the meantime.
      await registerPasswordUser(who.email);

      const res = await completeSignup(body.data.pendingToken);

      expect(res.status).toBe(409);
    });

    it("keeps Google and Apple as separate identities on one account", async () => {
      const email = `both${unique()}@test.com`;
      const google = identity({ email });
      const { body } = await socialSignIn(google);
      await completeSignup(body.data.pendingToken);

      const apple = identity({ provider: "apple", email });
      const res = await socialSignIn(apple);

      expect(res.status).toBe(200);
      const user = await User.findOne({ where: { email } });
      expect(user!.googleId).toBe(google.providerId);
      expect(user!.appleId).toBe(apple.providerId);
    });
  });

  describe("password login against a social-only account", () => {
    it("explains which button to use instead of 'wrong credentials'", async () => {
      const who = identity();
      const { body } = await socialSignIn(who);
      await completeSignup(body.data.pendingToken);

      const res = await request(app)
        .post("/auth/login")
        .send({ email: who.email, password: "AnyPassword1" });

      expect(res.status).toBe(401);
      // Sending this user to "forgot password" for a password that never
      // existed is the dead end this message avoids.
      expect(res.body.message).toMatch(/Google or Apple/i);
    });

    it("still lets them set a password through the reset flow", async () => {
      const who = identity();
      const { body } = await socialSignIn(who);
      await completeSignup(body.data.pendingToken);

      const res = await request(app)
        .post("/auth/forgot-password")
        .send({ email: who.email });

      expect(res.status).toBe(200);
    });
  });
});
