import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { AppMinVersion } from "../models/appMinVersion";

// Global setup.ts handles sequelize sync (force) + close. We only seed the row
// this suite asserts against.
beforeAll(async () => {
  await AppMinVersion.upsert({
    platform: "android",
    minVersion: "1.2.0",
    storeUrl:
      "https://play.google.com/store/apps/details?id=com.juroctech.frontend",
    message: "Please update.",
  });
});

describe("GET /version/check", () => {
  it("older version → updateRequired true with message + storeUrl", async () => {
    const res = await request(app).get(
      "/version/check?platform=android&version=1.0.0"
    );
    expect(res.status).toBe(200);
    expect(res.body.data.updateRequired).toBe(true);
    expect(res.body.data.storeUrl).toContain("play.google.com");
    expect(res.body.data.message).toBe("Please update.");
  });

  it("current version → updateRequired false", async () => {
    const res = await request(app).get(
      "/version/check?platform=android&version=1.2.0"
    );
    expect(res.status).toBe(200);
    expect(res.body.data.updateRequired).toBe(false);
  });

  it("unknown platform → updateRequired false (fail-open)", async () => {
    const res = await request(app).get(
      "/version/check?platform=web&version=0.1.0"
    );
    expect(res.status).toBe(200);
    expect(res.body.data.updateRequired).toBe(false);
  });

  it("missing params → updateRequired false", async () => {
    const res = await request(app).get("/version/check");
    expect(res.status).toBe(200);
    expect(res.body.data.updateRequired).toBe(false);
  });
});
