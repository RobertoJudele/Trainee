import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from "jose";
import { getOptionalEnv } from "../config/env";

export type SocialProvider = "google" | "apple";

export const SOCIAL_PROVIDERS: readonly SocialProvider[] = ["google", "apple"];

export interface SocialIdentity {
  provider: SocialProvider;
  /** The provider's stable user id (the `sub` claim). Never the email — emails change. */
  providerId: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
}

export class SocialAuthError extends Error {}

interface ProviderConfig {
  jwksUrl: string;
  /** jose accepts several accepted issuers; Google mints both spellings. */
  issuer: string | string[];
  audiences: () => string[];
}

const splitList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const PROVIDERS: Record<SocialProvider, ProviderConfig> = {
  google: {
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    // Both the Web and the iOS client id, comma-separated. On Android the Google
    // SDK mints an ID token whose `aud` is the WEB client id, not the Android one,
    // so the web id must be present or every Android sign-in fails.
    audiences: () => splitList(getOptionalEnv("GOOGLE_OAUTH_AUDIENCES")),
  },
  apple: {
    jwksUrl: "https://appleid.apple.com/auth/keys",
    issuer: "https://appleid.apple.com",
    // Native Sign in with Apple mints `aud` = the app's bundle id.
    audiences: () => splitList(getOptionalEnv("APPLE_BUNDLE_ID")),
  },
};

// Module scope on purpose: each instance caches the provider's keys and handles
// rotation with its own cooldown. Building one per request would refetch the JWKS
// on every sign-in and get us rate-limited.
const remoteKeySets: Record<SocialProvider, JWTVerifyGetKey> = {
  google: createRemoteJWKSet(new URL(PROVIDERS.google.jwksUrl)),
  apple: createRemoteJWKSet(new URL(PROVIDERS.apple.jwksUrl)),
};

/** Apple sends `email_verified` as a boolean on some tokens and the string "true" on others. */
const isVerifiedClaim = (value: unknown): boolean => value === true || value === "true";

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

/**
 * Exported for tests, which stand a local key set in for the remote one so the
 * signature/issuer/audience/expiry rules are exercised without network access.
 */
export const verifySocialIdTokenWith = async (
  provider: SocialProvider,
  idToken: string,
  keys: JWTVerifyGetKey
): Promise<SocialIdentity> => {
  const config = PROVIDERS[provider];
  const audience = config.audiences();

  if (audience.length === 0) {
    // Without an audience jose would accept a token minted for ANY app, which is
    // the whole attack this check exists to stop. Fail closed.
    throw new SocialAuthError(
      `${provider} sign-in is not configured on this server`
    );
  }

  let claims;
  try {
    ({ payload: claims } = await jwtVerify(idToken, keys, {
      issuer: config.issuer,
      audience,
    }));
  } catch (error) {
    throw new SocialAuthError(
      `Invalid ${provider} token: ${(error as Error).message}`
    );
  }

  const providerId = asString(claims.sub);
  const email = asString(claims.email)?.toLowerCase();

  if (!providerId) {
    throw new SocialAuthError(`${provider} token has no subject`);
  }
  if (!email) {
    throw new SocialAuthError(`${provider} token has no email`);
  }

  return {
    provider,
    providerId,
    email,
    emailVerified: isVerifiedClaim(claims.email_verified),
    // Google puts the name in the token. Apple never does — it hands the name to
    // the client on the first authorization only, so the caller supplies it there.
    firstName: asString(claims.given_name),
    lastName: asString(claims.family_name),
  };
};

export const verifySocialIdToken = (
  provider: SocialProvider,
  idToken: string
): Promise<SocialIdentity> =>
  verifySocialIdTokenWith(provider, idToken, remoteKeySets[provider]);

/** Test seam: build a verifier backed by an in-memory key set instead of the network. */
export const localKeySet = (jwks: JSONWebKeySet): JWTVerifyGetKey =>
  createLocalJWKSet(jwks);
