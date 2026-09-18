import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { PosterCode } from "../models/posterCode";
import { resetPosterFloodBuckets } from "../services/posterScanCounting";
import { appleStoreUrl, playStoreUrl } from "../utils/storeLinks";
import { createTestGym } from "./helpers";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

let counter = 0;
const makePoster = async (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return PosterCode.create({
    code: `scan${counter}${Date.now().toString(36).slice(-4)}`,
    label: "World Class Dorobanți",
    ...overrides,
  });
};

describe("GET /p/:code", () => {
  beforeEach(() => {
    resetPosterFloodBuckets();
  });

  it("serves the page, counts the scan and stamps last_scanned_at", async () => {
    const poster = await makePoster();

    const res = await request(app).get(`/p/${poster.code}`).set("User-Agent", IPHONE_UA);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("World Class Dorobanți");

    await poster.reload();
    expect(poster.scanCount).toBe(1);
    expect(poster.lastScannedAt).toBeTruthy();
  });

  it("is never cached, since a cached response is a swallowed scan", async () => {
    const poster = await makePoster();

    const res = await request(app).get(`/p/${poster.code}`).set("User-Agent", IPHONE_UA);

    expect(res.headers["cache-control"]).toContain("no-store");
  });

  it("returns no-store on 404 too, to prevent caching stale not-found responses", async () => {
    const res = await request(app).get("/p/unknown404").set("User-Agent", IPHONE_UA);

    expect(res.status).toBe(404);
    expect(res.headers["cache-control"]).toContain("no-store");
  });

  it("does not count a HEAD request", async () => {
    const poster = await makePoster();

    await request(app).head(`/p/${poster.code}`).set("User-Agent", IPHONE_UA);

    await poster.reload();
    expect(poster.scanCount).toBe(0);
  });

  it("serves a link-preview crawler without counting it", async () => {
    const poster = await makePoster();

    const res = await request(app)
      .get(`/p/${poster.code}`)
      .set("User-Agent", "facebookexternalhit/1.1");

    expect(res.status).toBe(200);
    await poster.reload();
    expect(poster.scanCount).toBe(0);
  });

  it("prefers the linked gym's name over the free-text label", async () => {
    const { gym } = await createTestGym({ name: "Smart Fit Unirii" });
    const poster = await makePoster({ gymId: gym.id, label: "eticheta veche" });

    const res = await request(app).get(`/p/${poster.code}`).set("User-Agent", IPHONE_UA);

    expect(res.text).toContain("Smart Fit Unirii");
    expect(res.text).not.toContain("eticheta veche");
  });

  it("404s an unknown code and a retired one", async () => {
    const retired = await makePoster({ isActive: false });

    expect((await request(app).get("/p/nope404")).status).toBe(404);
    expect((await request(app).get(`/p/${retired.code}`)).status).toBe(404);

    await retired.reload();
    expect(retired.scanCount).toBe(0);
  });
});

describe("GET /p/:code/start", () => {
  beforeEach(() => {
    resetPosterFloodBuckets();
  });

  it("sends an iPhone to the App Store and counts it there", async () => {
    const poster = await makePoster();

    const res = await request(app)
      .get(`/p/${poster.code}/start`)
      .set("User-Agent", IPHONE_UA);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(appleStoreUrl());

    await poster.reload();
    expect(poster.appleClickCount).toBe(1);
    expect(poster.playClickCount).toBe(0);
  });

  it("sends an Android phone to Play and counts it there", async () => {
    const poster = await makePoster();

    const res = await request(app)
      .get(`/p/${poster.code}/start`)
      .set("User-Agent", ANDROID_UA);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(playStoreUrl());

    await poster.reload();
    expect(poster.playClickCount).toBe(1);
    expect(poster.appleClickCount).toBe(0);
  });

  it("redirects a desktop visitor without counting either platform", async () => {
    const poster = await makePoster();

    const res = await request(app)
      .get(`/p/${poster.code}/start`)
      .set("User-Agent", DESKTOP_UA);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(playStoreUrl());

    await poster.reload();
    expect(poster.appleClickCount).toBe(0);
    expect(poster.playClickCount).toBe(0);
  });

  it("redirects rather than erroring on an unknown code", async () => {
    // Someone is standing in a gym. They should never meet an error page.
    const res = await request(app).get("/p/nope404/start").set("User-Agent", IPHONE_UA);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(appleStoreUrl());
  });
});
