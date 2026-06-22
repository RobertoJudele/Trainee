import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestUser } from "./helpers";

describe("Auth API", () => {
  describe("POST /auth/register", () => {
    it("should register a new user", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: `signup${Date.now()}@test.com`,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty("id");
      expect(res.body.data.user).toHaveProperty("email");
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    it("should reject duplicate email", async () => {
      const email = `dup${Date.now()}@test.com`;
      await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      const res = await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "Jane",
          lastName: "Doe",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should reject missing required fields", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ email: "missing@test.com" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject weak password", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: `weak${Date.now()}@test.com`,
          password: "weak",
          firstName: "John",
          lastName: "Doe",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /auth/login", () => {
    it("should login with valid credentials", async () => {
      const email = `login${Date.now()}@test.com`;
      await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      const res = await request(app)
        .post("/auth/login")
        .send({ email, password: "Test123!" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it("should reject wrong password", async () => {
      const email = `wrongpw${Date.now()}@test.com`;
      await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      const res = await request(app)
        .post("/auth/login")
        .send({ email, password: "WrongPassword1" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject nonexistent email", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "nobody@test.com", password: "Test123!" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /auth/refresh", () => {
    it("should issue new tokens with valid refresh token", async () => {
      const email = `refresh${Date.now()}@test.com`;
      const signupRes = await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      const refreshToken = signupRes.body.data.refreshToken;

      const res = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it("should reject missing refresh token", async () => {
      const res = await request(app)
        .post("/auth/refresh")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject invalid refresh token", async () => {
      const res = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: "invalidtoken123" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("should return success for valid email without leaking info", async () => {
      const email = `forgot${Date.now()}@test.com`;
      await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      const res = await request(app)
        .post("/auth/forgot-password")
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return success even for nonexistent email (no info leak)", async () => {
      const res = await request(app)
        .post("/auth/forgot-password")
        .send({ email: "nonexistent@test.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /auth/profile", () => {
    it("should return profile for authenticated user", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/auth/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("email");
    });

    it("should return 401 without token", async () => {
      const res = await request(app).get("/auth/profile");

      expect(res.status).toBe(401);
    });
  });
});
