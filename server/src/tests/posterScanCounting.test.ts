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
}): Request =>
  ({
    method: overrides.method ?? "GET",
    headers: overrides.userAgent ? { "user-agent": overrides.userAgent } : {},
    ip: overrides.ip ?? "203.0.113.10",
    socket: { remoteAddress: overrides.ip ?? "203.0.113.10" },
  } as unknown as Request);

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
});
