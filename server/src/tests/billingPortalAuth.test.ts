import "./withDatabase";
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestTrainer } from "./helpers";

// POST /billing/create-checkout-session and /billing/create-portal-session
// (and their duplicate, backward-compatible registrations at the top level,
// /create-checkout-session and /create-portal-session) used to have no
// `authenticate` middleware at all - unlike every other billing route.
// create-portal-session was the dangerous one: it took `customerId` straight
// from the request body with no check that it belonged to the caller, so
// naming any real Stripe customer id got back a live portal session for that
// customer's invoices, payment method and subscription.
describe("Billing portal/checkout authentication", () => {
  const paths = [
    "/billing/create-checkout-session",
    "/billing/create-portal-session",
    "/create-checkout-session",
    "/create-portal-session",
  ];

  for (const path of paths) {
    it(`rejects an unauthenticated request to ${path}`, async () => {
      const res = await request(app).post(path).send({});
      expect(res.status).toBe(401);
    });
  }

  it("rejects a portal session for a Stripe customer that belongs to someone else", async () => {
    const { trainer: owner } = await createTestTrainer();
    await owner.update({ stripeCustomerId: "cus_test_owner_only" });

    const { token: strangerToken } = await createTestTrainer();

    const res = await request(app)
      .post("/billing/create-portal-session")
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ customerId: "cus_test_owner_only" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("rejects a portal session for a Stripe customer id that belongs to no one", async () => {
    const { token } = await createTestTrainer();

    const res = await request(app)
      .post("/billing/create-portal-session")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId: "cus_does_not_exist" });

    expect(res.status).toBe(403);
  });
});
