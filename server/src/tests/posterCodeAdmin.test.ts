import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { PosterCode } from "../models/posterCode";
import { createTestUser } from "./helpers";

const adminToken = async (): Promise<string> =>
  (await createTestUser({ role: "admin" })).token;

describe("POST /poster-codes", () => {
  it("creates a code, generating one when none is supplied", async () => {
    const token = await adminToken();

    const res = await request(app)
      .post("/poster-codes")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "World Class Dorobanți" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toMatch(/^[a-z0-9]{6}$/);
    expect(res.body.data.scanCount).toBe(0);
    expect(res.body.data.url).toContain(`/p/${res.body.data.code}`);
  });

  it("accepts a hand-written code and rejects a malformed one", async () => {
    const token = await adminToken();

    const ok = await request(app)
      .post("/poster-codes")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Sala Veche", code: "wc-dorobanti" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.code).toBe("wc-dorobanti");

    const bad = await request(app)
      .post("/poster-codes")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Sala Veche", code: "Has Upper" });
    expect(bad.status).toBe(400);
  });

  it("rejects a duplicate code with 409 rather than a 500", async () => {
    const token = await adminToken();
    await PosterCode.create({ code: "taken1", label: "Sala A" });

    const res = await request(app)
      .post("/poster-codes")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Sala B", code: "taken1" });

    expect(res.status).toBe(409);
  });
});

describe("GET /poster-codes", () => {
  it("lists codes with their counters, busiest first", async () => {
    const token = await adminToken();
    await PosterCode.create({ code: "quiet1", label: "Sala Liniștită", scanCount: 2 });
    await PosterCode.create({ code: "busy01", label: "Sala Plină", scanCount: 99 });

    const res = await request(app)
      .get("/poster-codes")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const codes = res.body.data.map((row: { code: string }) => row.code);
    expect(codes.indexOf("busy01")).toBeLessThan(codes.indexOf("quiet1"));
    expect(res.body.data[0]).toHaveProperty("appleClickCount");
    expect(res.body.data[0]).toHaveProperty("lastScannedAt");
    expect(res.body.data[0]).toHaveProperty("url");
  });
});

describe("PATCH /poster-codes/:id", () => {
  it("retires a poster so its URL stops resolving but its counts survive", async () => {
    const token = await adminToken();
    const poster = await PosterCode.create({
      code: "retire",
      label: "Sala Închisă",
      scanCount: 41,
    });

    const res = await request(app)
      .patch(`/poster-codes/${poster.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);

    await poster.reload();
    expect(poster.isActive).toBe(false);
    expect(poster.scanCount).toBe(41);
    expect((await request(app).get(`/p/${poster.code}`)).status).toBe(404);
  });
});

describe("poster code admin authorization", () => {
  it("refuses a non-admin on every route", async () => {
    const { token } = await createTestUser({ role: "client" });
    const poster = await PosterCode.create({ code: "guard1", label: "Sala" });

    expect(
      (
        await request(app)
          .post("/poster-codes")
          .set("Authorization", `Bearer ${token}`)
          .send({ label: "Sala" })
      ).status
    ).toBe(403);

    expect(
      (await request(app).get("/poster-codes").set("Authorization", `Bearer ${token}`))
        .status
    ).toBe(403);

    expect(
      (
        await request(app)
          .patch(`/poster-codes/${poster.id}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ isActive: false })
      ).status
    ).toBe(403);
  });

  it("refuses an unauthenticated caller", async () => {
    expect((await request(app).get("/poster-codes")).status).toBe(401);
  });
});
