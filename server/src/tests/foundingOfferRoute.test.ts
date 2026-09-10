import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestUser } from "./helpers";

/**
 * Regression test for a bug that shipped: the offer was originally returned by
 * GET /billing/entitlement, which calls requireBillingState and throws
 * NOT_TRAINER for anyone without a trainer profile. Since the banner lives on
 * the become-a-trainer form, its entire audience got a 4xx and the banner never
 * rendered.
 *
 * The route must therefore work for a plain client — that is the whole point.
 */
describe("GET /billing/founding-offer", () => {
  it("serves the offer to a client who is not a trainer yet", async () => {
    const { token } = await createTestUser({ role: "client" });

    const res = await request(app)
      .get("/billing/founding-offer")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("isOpen");
    expect(res.body.data).toHaveProperty("months");
  });

  it("returns a usable deadline while the promo is open", async () => {
    const { token } = await createTestUser({ role: "client" });

    const res = await request(app)
      .get("/billing/founding-offer")
      .set("Authorization", `Bearer ${token}`);

    const offer = res.body.data;
    if (offer.isOpen) {
      expect(offer.months).toBeGreaterThan(0);
      expect(typeof offer.deadline).toBe("string");
      expect(Number.isFinite(new Date(offer.deadline).getTime())).toBe(true);
    } else {
      // Closed promo must not hand the app a stale date to render.
      expect(offer.months).toBe(0);
      expect(offer.deadline).toBeUndefined();
    }
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/billing/founding-offer");
    expect(res.status).toBe(401);
  });
});
