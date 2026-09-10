import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { AppMinVersion } from "../models/appMinVersion";
import { AppReleaseNote } from "../models/appReleaseNote";

/**
 * Release notes ride the existing /version/check call. These cover the rules the
 * client depends on: notes only for the exact running version, never alongside a
 * forced update, and nothing at all for drafts.
 */
describe("GET /version/check — release notes", () => {
  beforeEach(async () => {
    await AppReleaseNote.destroy({ where: {} });
    await AppMinVersion.destroy({ where: {} });
    await AppMinVersion.create({
      platform: "android",
      minVersion: "1.0.0",
      storeUrl: "https://play.google.com/store/apps/details?id=com.juroctech.frontend",
      message: "Update please",
    });
  });

  const check = (version: string) =>
    request(app).get(`/version/check?platform=android&version=${version}`);

  it("returns published notes for the running version", async () => {
    await AppReleaseNote.create({
      version: "1.1.0",
      title: "Profil public",
      body: "Ai acum o pagină web proprie.",
      isPublished: true,
    });

    const res = await check("1.1.0");
    expect(res.status).toBe(200);
    expect(res.body.data.releaseNotes).toMatchObject({
      version: "1.1.0",
      title: "Profil public",
    });
  });

  it("returns nothing for a version with no notes", async () => {
    // Skipping a release needs no special handling.
    const res = await check("1.2.0");
    expect(res.body.data.releaseNotes).toBeNull();
  });

  it("hides draft notes", async () => {
    await AppReleaseNote.create({
      version: "1.1.0",
      title: "Nepublicat",
      body: "Scris inainte ca build-ul sa fie live.",
      isPublished: false,
    });

    const res = await check("1.1.0");
    expect(res.body.data.releaseNotes).toBeNull();
  });

  it("does not send notes alongside a forced update", async () => {
    // The client shows a blocking wall then; a what's-new sheet behind it would
    // be noise, and the notes describe a version being replaced anyway.
    await AppMinVersion.update({ minVersion: "2.0.0" }, { where: { platform: "android" } });
    await AppReleaseNote.create({
      version: "1.1.0",
      title: "Profil public",
      body: "Ai acum o pagină web proprie.",
      isPublished: true,
    });

    const res = await check("1.1.0");
    expect(res.body.data.updateRequired).toBe(true);
    expect(res.body.data.releaseNotes).toBeNull();
  });

  it("stays fail-open for an unknown platform", async () => {
    const res = await request(app).get("/version/check?platform=windows&version=1.1.0");
    expect(res.status).toBe(200);
    expect(res.body.data.updateRequired).toBe(false);
    expect(res.body.data.releaseNotes).toBeNull();
  });
});
