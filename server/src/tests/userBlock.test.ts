import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestUser } from "./helpers";

// App builds from before the apiSlice.ts fix treat a 401 with no refresh token
// as "session over" and reset their whole cache, which re-runs this query, which
// 401s again. On a trainer profile that loop re-fetched /trainer/:id until the
// public rate limit answered 429. A logged-out visitor simply has no blocks.
describe("GET /blocks", () => {
  it("answers a logged-out request with an empty list", async () => {
    const res = await request(app).get("/blocks");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("still rejects a bad token, so the app refreshes an expired session", async () => {
    const res = await request(app)
      .get("/blocks")
      .set("Authorization", "Bearer not-a-jwt");

    expect(res.status).toBe(401);
  });

  it("lists the caller's blocks when logged in", async () => {
    const { token } = await createTestUser();

    const res = await request(app)
      .get("/blocks")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("still requires a login to block someone", async () => {
    const res = await request(app).post("/blocks").send({ blockedUserId: 1 });

    expect(res.status).toBe(401);
  });
});
