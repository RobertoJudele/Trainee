import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestUser } from "./helpers";

describe("User API", () => {
  describe("PUT /users", () => {
    it("should update user profile", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .put("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "Updated",
          lastName: "Name",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject update without auth", async () => {
      const res = await request(app)
        .put("/users")
        .send({ firstName: "Hacker" });

      expect(res.status).toBe(401);
    });

    it("should reject invalid field values", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .put("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ firstName: "A" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /users", () => {
    it("should delete user account", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .delete("/users")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject delete without auth", async () => {
      const res = await request(app).delete("/users");

      expect(res.status).toBe(401);
    });
  });
});
