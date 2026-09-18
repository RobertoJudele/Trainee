import { describe, it, expect, beforeEach } from "@jest/globals";
import { Request } from "express";
import {
  detectStorePlatform,
  isCrawlerUserAgent,
  resetPosterFloodBuckets,
  shouldCountPosterHit,
} from "../services/posterScanCounting";

const fakeRequest = (overrides: {
  method?: string;
  userAgent?: string;
  ip?: string;
  headers?: Record<string, string | string[]>;
}): Request => {
  const headers: Record<string, string | string[]> = overrides.headers
    ? { ...overrides.headers }
    : {};
  if (overrides.userAgent) {
    headers["user-agent"] = overrides.userAgent;
  }
  return {
    method: overrides.method ?? "GET",
    headers,
    ip: overrides.ip ?? "203.0.113.10",
    socket: { remoteAddress: overrides.ip ?? "203.0.113.10" },
  } as unknown as Request;
};

describe("isCrawlerUserAgent", () => {
  it("matches the link-preview bots that fetch a shared poster URL", () => {
    expect(isCrawlerUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isCrawlerUserAgent("WhatsApp/2.23")).toBe(true);
    expect(isCrawlerUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isCrawlerUserAgent("TelegramBot (like TwitterBot)")).toBe(true);
  });

  it("does not match a real phone browser", () => {
    expect(
      isCrawlerUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
      )
    ).toBe(false);
  });
});

describe("detectStorePlatform", () => {
  it("reads the platform off the user agent", () => {
    expect(
      detectStorePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")
    ).toBe("ios");
    expect(detectStorePlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(
      "android"
    );
    expect(detectStorePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(
      "unknown"
    );
    expect(detectStorePlatform(undefined)).toBe("unknown");
  });
});

describe("shouldCountPosterHit", () => {
  beforeEach(() => {
    resetPosterFloodBuckets();
  });

  it("counts a normal phone visit", () => {
    expect(
      shouldCountPosterHit(
        fakeRequest({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" })
      )
    ).toBe(true);
  });

  it("does not count a HEAD request", () => {
    // Express serves GET handlers for HEAD too, so a link checker would
    // otherwise double every scan.
    expect(
      shouldCountPosterHit(
        fakeRequest({ method: "HEAD", userAgent: "Mozilla/5.0 (iPhone)" })
      )
    ).toBe(false);
  });

  it("does not count a link-preview crawler", () => {
    expect(
      shouldCountPosterHit(fakeRequest({ userAgent: "facebookexternalhit/1.1" }))
    ).toBe(false);
  });

  it("stops counting one IP past the flood threshold but keeps counting another", () => {
    const flooder = { userAgent: "Mozilla/5.0 (iPhone)", ip: "198.51.100.5" };
    let counted = 0;
    for (let i = 0; i < 200; i += 1) {
      if (shouldCountPosterHit(fakeRequest(flooder))) counted += 1;
    }

    expect(counted).toBe(120);
    expect(
      shouldCountPosterHit(
        fakeRequest({ userAgent: "Mozilla/5.0 (iPhone)", ip: "198.51.100.6" })
      )
    ).toBe(true);
  });

  it("uses leftmost x-forwarded-for address (string form) for flood bucketing", () => {
    const xff1 = "1.2.3.4, 10.0.0.1";
    const xff1_different_rightmost = "1.2.3.4, 10.0.0.2";
    const xff2 = "5.6.7.8, 10.0.0.1";

    let counted1 = 0;

    // Flood with xff1 and its variant (same leftmost, different rightmost)
    for (let i = 0; i < 150; i += 1) {
      const xff = i % 2 === 0 ? xff1 : xff1_different_rightmost;
      if (
        shouldCountPosterHit(
          fakeRequest({
            userAgent: "Mozilla/5.0 (iPhone)",
            headers: { "x-forwarded-for": xff },
          })
        )
      ) {
        counted1 += 1;
      }
    }

    // Try with xff2 (different leftmost address)
    const counted2 = shouldCountPosterHit(
      fakeRequest({
        userAgent: "Mozilla/5.0 (iPhone)",
        headers: { "x-forwarded-for": xff2 },
      })
    )
      ? 1
      : 0;

    // Both xff1 variants should bucket together under 1.2.3.4, hitting limit at 120
    expect(counted1).toBe(120);
    // Different leftmost should count (5.6.7.8 is independent bucket)
    expect(counted2).toBe(1);
  });

  it("uses leftmost x-forwarded-for address (array form) for flood bucketing", () => {
    const xffArray1a = ["1.2.3.4, 10.0.0.1", "9.9.9.9"];
    const xffArray1b = ["1.2.3.4, 10.0.0.2", "8.8.8.8"];
    const xffArray2 = ["5.6.7.8, 10.0.0.1"];

    let counted1 = 0;

    // Flood with alternating array-form XFF (same leftmost 1.2.3.4 after split,
    // different rest). The leading element contains a comma to verify the split
    // happens inside forwardedFor[0].
    for (let i = 0; i < 150; i += 1) {
      const xff = i % 2 === 0 ? xffArray1a : xffArray1b;
      if (
        shouldCountPosterHit(
          fakeRequest({
            userAgent: "Mozilla/5.0 (iPhone)",
            headers: { "x-forwarded-for": xff },
            ip: "203.0.113.10",
          })
        )
      ) {
        counted1 += 1;
      }
    }

    // Try with array-form different leftmost, SAME IP as flood requests.
    // If array branch is ignored, this would bucket under the fallback IP
    // (already saturated), and would not count.
    const counted2 = shouldCountPosterHit(
      fakeRequest({
        userAgent: "Mozilla/5.0 (iPhone)",
        headers: { "x-forwarded-for": xffArray2 },
        ip: "203.0.113.10",
      })
    )
      ? 1
      : 0;

    // Both array forms should bucket together under 1.2.3.4, hitting limit at 120
    expect(counted1).toBe(120);
    // Different leftmost (5.6.7.8) should count via its own bucket
    expect(counted2).toBe(1);
  });
});
