import "./withDatabase";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { LandingEvent } from "../models/landingEvent";
import { resetPosterFloodBuckets } from "../services/posterScanCounting";
import { resetLandingRepeats } from "../services/landingCounting";
import { appleStoreUrl, playStoreUrl } from "../utils/storeLinks";
import { SALVIO_INSTAGRAM_URL } from "../services/trainerLandingPage";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36";
const INSTAGRAM_PREVIEW_UA = "facebookexternalhit/1.1";

beforeEach(async () => {
  resetPosterFloodBuckets();
  resetLandingRepeats();
  await LandingEvent.destroy({ where: {} });
});

describe("GET /antrenori", () => {
  it("serves the page and counts the visit with its source and device", async () => {
    const res = await request(app).get("/antrenori?src=IG").set("User-Agent", IPHONE_UA);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.text).toContain("Fii <span class=\"accent\">primul</span> antrenor");

    const events = await LandingEvent.findAll();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("visit");
    expect(events[0].source).toBe("ig");
    expect(events[0].device).toBe("ios");
  });

  it("makes Google Play the big button on Android", async () => {
    const res = await request(app).get("/antrenori").set("User-Agent", ANDROID_UA);

    expect(res.text).toMatch(/class="store primary" href="\/antrenori\/go\/android/);
  });

  it("counts a reload from the same address once", async () => {
    await request(app).get("/antrenori").set("User-Agent", IPHONE_UA);
    await request(app).get("/antrenori").set("User-Agent", IPHONE_UA);

    expect(await LandingEvent.count()).toBe(1);
  });

  it("does not count link-preview crawlers", async () => {
    const res = await request(app).get("/antrenori").set("User-Agent", INSTAGRAM_PREVIEW_UA);

    expect(res.status).toBe(200);
    expect(await LandingEvent.count()).toBe(0);
  });
});

describe("GET /antrenori/go/:target", () => {
  it("redirects to the App Store and counts the click with its button", async () => {
    const res = await request(app)
      .get("/antrenori/go/ios?from=bottom&src=tt")
      .set("User-Agent", IPHONE_UA);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(appleStoreUrl());

    const event = await LandingEvent.findOne();
    expect(event?.kind).toBe("click");
    expect(event?.target).toBe("ios");
    expect(event?.position).toBe("bottom");
    expect(event?.source).toBe("tt");
  });

  it("redirects to Google Play and to Instagram", async () => {
    const play = await request(app).get("/antrenori/go/android?from=top").set("User-Agent", ANDROID_UA);
    const ig = await request(app).get("/antrenori/go/instagram?from=faq").set("User-Agent", ANDROID_UA);

    expect(play.headers.location).toBe(playStoreUrl());
    expect(ig.headers.location).toBe(SALVIO_INSTAGRAM_URL);
    expect(await LandingEvent.count({ where: { kind: "click" } })).toBe(2);
  });

  it("drops a position it does not know instead of storing it", async () => {
    await request(app).get("/antrenori/go/ios?from=<b>").set("User-Agent", IPHONE_UA);

    expect((await LandingEvent.findOne())?.position).toBeNull();
  });

  it("answers 404 for anything that is not a known target", async () => {
    const res = await request(app).get("/antrenori/go/evil.example.com");

    expect(res.status).toBe(404);
    expect(await LandingEvent.count()).toBe(0);
  });
});

describe("GET /antrenori/img/:file", () => {
  it("serves a listed screenshot with a long cache", async () => {
    const res = await request(app).get("/antrenori/img/sala.jpg");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/jpeg");
    expect(res.headers["cache-control"]).toContain("max-age=604800");
  });

  it("serves nothing that is not on the list", async () => {
    expect((await request(app).get("/antrenori/img/..%2F..%2Fpackage.json")).status).toBe(404);
    expect((await request(app).get("/antrenori/img/logo.png")).status).toBe(404);
  });
});

describe("GET /antrenori/stats", () => {
  const original = process.env.LANDING_STATS_KEY;
  afterEach(() => {
    process.env.LANDING_STATS_KEY = original;
  });

  it("is a 404 while no key is configured", async () => {
    delete process.env.LANDING_STATS_KEY;

    expect((await request(app).get("/antrenori/stats?key=")).status).toBe(404);
  });

  it("is a 404 with the wrong key", async () => {
    process.env.LANDING_STATS_KEY = "right-key";

    expect((await request(app).get("/antrenori/stats?key=wrong-key")).status).toBe(404);
  });

  it("shows the counts with the right key", async () => {
    process.env.LANDING_STATS_KEY = "right-key";
    await request(app).get("/antrenori?src=ig").set("User-Agent", IPHONE_UA);
    await request(app).get("/antrenori/go/ios?from=top&src=ig").set("User-Agent", IPHONE_UA);

    const res = await request(app).get("/antrenori/stats?key=right-key");

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.text).toContain("Ultimele 7 zile");
    expect(res.text).toMatch(/<span>Vizite<\/span><b>1<\/b>/);
    expect(res.text).toMatch(/<span>App Store<\/span><b>1<\/b>/);
    expect(res.text).toContain("<td>Instagram</td><td>1</td><td>1</td><td>100%</td>");
  });
});
