import { describe, it, expect, beforeAll, afterEach } from "@jest/globals";
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type KeyLike,
  type JSONWebKeySet,
  type JWK,
} from "jose";
import {
  SocialAuthError,
  localKeySet,
  verifySocialIdTokenWith,
  type SocialProvider,
} from "../services/socialAuth";

// These exercise the real jwtVerify path with a locally minted key, so the
// signature, issuer, audience and expiry rules are all genuinely checked. Only
// the network fetch of the provider's JWKS is stood in for -- that part is
// jose's code, not ours.

const KID = "test-key-1";
const GOOGLE_WEB_AUD = "111-web.apps.googleusercontent.com";
const GOOGLE_IOS_AUD = "111-ios.apps.googleusercontent.com";
const APPLE_AUD = "com.juroctech.frontend";

let privateKey: KeyLike;
let jwks: JSONWebKeySet;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  const publicJwk = (await exportJWK(pair.publicKey)) as JWK;
  jwks = { keys: [{ ...publicJwk, kid: KID, alg: "RS256", use: "sig" }] };
});

interface TokenOptions {
  issuer?: string;
  audience?: string;
  sub?: string;
  email?: string | null;
  emailVerified?: unknown;
  expiresIn?: string | number;
  claims?: Record<string, unknown>;
}

const mintToken = async (options: TokenOptions = {}): Promise<string> => {
  const payload: Record<string, unknown> = { ...options.claims };
  if (options.email !== null) {
    payload.email = options.email ?? "user@example.com";
  }
  if (options.emailVerified !== undefined) {
    payload.email_verified = options.emailVerified;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuedAt()
    .setIssuer(options.issuer ?? "https://accounts.google.com")
    .setAudience(options.audience ?? GOOGLE_WEB_AUD)
    .setSubject(options.sub ?? "google-sub-123")
    .setExpirationTime(options.expiresIn ?? "5m")
    .sign(privateKey);
};

const verify = (provider: SocialProvider, token: string) =>
  verifySocialIdTokenWith(provider, token, localKeySet(jwks));

const withEnv = (vars: Record<string, string | undefined>) => {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const ORIGINAL_ENV = {
  GOOGLE_OAUTH_AUDIENCES: process.env.GOOGLE_OAUTH_AUDIENCES,
  APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID,
};

afterEach(() => withEnv(ORIGINAL_ENV));

const configure = () =>
  withEnv({
    GOOGLE_OAUTH_AUDIENCES: `${GOOGLE_WEB_AUD}, ${GOOGLE_IOS_AUD}`,
    APPLE_BUNDLE_ID: APPLE_AUD,
  });

describe("verifySocialIdToken", () => {
  describe("Google", () => {
    it("accepts a well-formed token and returns the identity", async () => {
      configure();
      const token = await mintToken({
        emailVerified: true,
        claims: { given_name: "Ana", family_name: "Popescu" },
      });

      const identity = await verify("google", token);

      expect(identity).toEqual({
        provider: "google",
        providerId: "google-sub-123",
        email: "user@example.com",
        emailVerified: true,
        firstName: "Ana",
        lastName: "Popescu",
      });
    });

    // The Android SDK mints tokens against the WEB client id, not the Android
    // one. If only the iOS id were accepted every Android sign-in would fail.
    it("accepts a token minted for any configured audience", async () => {
      configure();
      const token = await mintToken({
        audience: GOOGLE_IOS_AUD,
        emailVerified: true,
      });

      await expect(verify("google", token)).resolves.toMatchObject({
        providerId: "google-sub-123",
      });
    });

    it("accepts the bare issuer spelling Google also mints", async () => {
      configure();
      const token = await mintToken({
        issuer: "accounts.google.com",
        emailVerified: true,
      });

      await expect(verify("google", token)).resolves.toMatchObject({
        emailVerified: true,
      });
    });

    // The whole point of the audience check: a token minted for someone else's
    // app is a valid Google token, and must not be a valid Salvio login.
    it("rejects a token minted for another app", async () => {
      configure();
      const token = await mintToken({ audience: "some-other-app.com" });

      await expect(verify("google", token)).rejects.toThrow(SocialAuthError);
    });

    it("rejects a token from the wrong issuer", async () => {
      configure();
      const token = await mintToken({ issuer: "https://evil.example.com" });

      await expect(verify("google", token)).rejects.toThrow(SocialAuthError);
    });

    it("rejects an expired token", async () => {
      configure();
      const token = await mintToken({ expiresIn: "-1m", emailVerified: true });

      await expect(verify("google", token)).rejects.toThrow(SocialAuthError);
    });

    it("rejects a tampered signature", async () => {
      configure();
      const token = await mintToken({ emailVerified: true });
      const [header, , signature] = token.split(".");
      const forgedPayload = Buffer.from(
        JSON.stringify({
          iss: "https://accounts.google.com",
          aud: GOOGLE_WEB_AUD,
          sub: "attacker",
          email: "victim@example.com",
          email_verified: true,
          exp: Math.floor(Date.now() / 1000) + 600,
        })
      ).toString("base64url");

      await expect(
        verify("google", `${header}.${forgedPayload}.${signature}`)
      ).rejects.toThrow(SocialAuthError);
    });

    it("rejects a token with no email", async () => {
      configure();
      const token = await mintToken({ email: null, emailVerified: true });

      await expect(verify("google", token)).rejects.toThrow(/no email/);
    });

    it("reports an unverified email rather than claiming it is verified", async () => {
      configure();
      const token = await mintToken({ emailVerified: false });

      await expect(verify("google", token)).resolves.toMatchObject({
        emailVerified: false,
      });
    });

    it("lowercases the email so linking is not case-sensitive", async () => {
      configure();
      const token = await mintToken({
        email: "Mixed.Case@Example.COM",
        emailVerified: true,
      });

      await expect(verify("google", token)).resolves.toMatchObject({
        email: "mixed.case@example.com",
      });
    });

    // Fail closed: with no audience configured jose would accept a token minted
    // for any app at all.
    it("refuses to verify when no audience is configured", async () => {
      withEnv({ GOOGLE_OAUTH_AUDIENCES: undefined });
      const token = await mintToken({ emailVerified: true });

      await expect(verify("google", token)).rejects.toThrow(/not configured/);
    });
  });

  describe("Apple", () => {
    const mintApple = (options: TokenOptions = {}) =>
      mintToken({
        issuer: "https://appleid.apple.com",
        audience: APPLE_AUD,
        sub: "apple-sub-999",
        ...options,
      });

    it("accepts a well-formed token", async () => {
      configure();
      const token = await mintApple({ emailVerified: true });

      await expect(verify("apple", token)).resolves.toMatchObject({
        provider: "apple",
        providerId: "apple-sub-999",
        emailVerified: true,
      });
    });

    // Apple sends email_verified as the STRING "true" on some tokens. Treating
    // that as falsy would silently stop every Apple account from linking.
    it('treats the string "true" as verified', async () => {
      configure();
      const token = await mintApple({ emailVerified: "true" });

      await expect(verify("apple", token)).resolves.toMatchObject({
        emailVerified: true,
      });
    });

    it("accepts a private relay address", async () => {
      configure();
      const token = await mintApple({
        email: "abc123@privaterelay.appleid.com",
        emailVerified: true,
      });

      await expect(verify("apple", token)).resolves.toMatchObject({
        email: "abc123@privaterelay.appleid.com",
      });
    });

    // Apple never puts the name in the token -- it hands it to the client on the
    // first authorization only, so the controller has to fall back to the body.
    it("returns no name, since Apple does not put one in the token", async () => {
      configure();
      const token = await mintApple({ emailVerified: true });

      const identity = await verify("apple", token);
      expect(identity.firstName).toBeUndefined();
      expect(identity.lastName).toBeUndefined();
    });

    // Cross-provider confusion: a genuine Google token must not authenticate an
    // Apple sign-in, or the two id namespaces could collide.
    it("rejects a Google token presented as an Apple one", async () => {
      configure();
      const token = await mintToken({ emailVerified: true });

      await expect(verify("apple", token)).rejects.toThrow(SocialAuthError);
    });
  });
});
