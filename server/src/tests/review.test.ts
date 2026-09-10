import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestTrainer, createTestUser } from "./helpers";
import { TrainerClient } from "../models/trainerClient";
import { Trainer } from "../models/trainer";
import { RATING_PRIOR, shrinkRating } from "../utils/rating";

// Reviews are limited to the trainer's own clients, so every test that posts one
// has to put the client on the roster first.
async function connect(trainerId: number, clientId: number): Promise<void> {
  await TrainerClient.create({ trainerId, clientId });
}

async function connectedClient(trainerId: number) {
  const { user, token } = await createTestUser();
  await connect(trainerId, user.id);
  return { user, token };
}

function postReview(
  trainerId: number,
  token: string,
  body: { rating: number; reviewText?: string }
) {
  return request(app)
    .post(`/reviews/${trainerId}`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

describe("Review API", () => {
  describe("GET /reviews/:trainerId", () => {
    it("should return reviews for a trainer", async () => {
      const { trainer } = await createTestTrainer();
      const { token: clientToken } = await connectedClient(trainer.id);

      await postReview(trainer.id, clientToken, {
        rating: 5,
        reviewText: "Great trainer experience!",
      });

      const res = await request(app).get(`/reviews/${trainer.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].rating).toBe(5);
      expect(res.body.data[0]).toHaveProperty("client");
    });

    it("should return empty array for trainer with no reviews", async () => {
      const { trainer } = await createTestTrainer();

      const res = await request(app).get(`/reviews/${trainer.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("POST /reviews/:trainerId", () => {
    it("should create a review", async () => {
      const { trainer } = await createTestTrainer();
      const { token: clientToken } = await connectedClient(trainer.id);

      const res = await postReview(trainer.id, clientToken, {
        rating: 4,
        reviewText: "Very helpful and professional",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(4);
    });

    it("should reject a trainer reviewing their own profile", async () => {
      // Burn a couple of user ids first so trainer.id and the trainer's user.id
      // cannot coincide — the check used to compare those two directly, which
      // only ever fired when the values happened to line up.
      await createTestUser();
      await createTestUser();
      const { trainer, user, token } = await createTestTrainer();
      expect(trainer.id).not.toBe(user.id);

      const res = await postReview(trainer.id, token, {
        rating: 5,
        reviewText: "I am an excellent trainer",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/themself/i);
    });

    it("should reject duplicate review", async () => {
      const { trainer } = await createTestTrainer();
      const { token: clientToken } = await connectedClient(trainer.id);

      await postReview(trainer.id, clientToken, {
        rating: 5,
        reviewText: "First review is great",
      });

      const res = await postReview(trainer.id, clientToken, {
        rating: 3,
        reviewText: "Trying to review again",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject without auth", async () => {
      const { trainer } = await createTestTrainer();

      const res = await request(app)
        .post(`/reviews/${trainer.id}`)
        .send({ rating: 5 });

      expect(res.status).toBe(401);
    });
  });

  describe("PUT /reviews/:reviewId", () => {
    it("should update own review", async () => {
      const { trainer } = await createTestTrainer();
      const { token: clientToken } = await connectedClient(trainer.id);

      const createRes = await postReview(trainer.id, clientToken, {
        rating: 3,
        reviewText: "Good but could improve",
      });

      const reviewId = createRes.body.data.id;

      const res = await request(app)
        .put(`/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ rating: 5, reviewText: "Actually amazing after second session" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject update from non-owner", async () => {
      const { trainer } = await createTestTrainer();
      const { token: clientToken } = await connectedClient(trainer.id);
      const { token: otherToken } = await createTestUser();

      const createRes = await postReview(trainer.id, clientToken, {
        rating: 4,
        reviewText: "Solid trainer experience",
      });

      const reviewId = createRes.body.data.id;

      const res = await request(app)
        .put(`/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ rating: 1 });

      expect([400, 403, 404]).toContain(res.status);
    });
  });

  describe("DELETE /reviews/:reviewId", () => {
    it("should delete own review", async () => {
      const { trainer } = await createTestTrainer();
      const { token: clientToken } = await connectedClient(trainer.id);

      const createRes = await postReview(trainer.id, clientToken, {
        rating: 2,
        reviewText: "Not great, removing review",
      });

      const reviewId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject delete from non-owner", async () => {
      const { trainer } = await createTestTrainer();
      const { token: clientToken } = await connectedClient(trainer.id);
      const { token: otherToken } = await createTestUser();

      const createRes = await postReview(trainer.id, clientToken, {
        rating: 4,
        reviewText: "Good trainer would recommend",
      });

      const reviewId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });
});

describe("Review creation gate", () => {
  it("rejects a client who is not on the trainer's roster", async () => {
    const { trainer } = await createTestTrainer();
    const { token } = await createTestUser();

    const res = await postReview(trainer.id, token, {
      rating: 5,
      reviewText: "Great sessions, highly recommended.",
    });

    expect(res.status).toBe(403);
  });

  it("accepts a client the trainer has taken on", async () => {
    const { trainer } = await createTestTrainer();
    const { token } = await connectedClient(trainer.id);

    const res = await postReview(trainer.id, token, {
      rating: 5,
      reviewText: "Great sessions, highly recommended.",
    });

    expect(res.status).toBe(201);
  });

  it("does not let a roster entry for one trainer unlock another", async () => {
    const { trainer: mine } = await createTestTrainer();
    const { trainer: other } = await createTestTrainer();
    const { token } = await connectedClient(mine.id);

    const res = await postReview(other.id, token, {
      rating: 1,
      reviewText: "Never trained with this person.",
    });

    expect(res.status).toBe(403);
  });
});

describe("Trainer rating aggregation", () => {
  it("counts rating-only reviews in both the average and the count", async () => {
    const { trainer } = await createTestTrainer();
    const withText = await connectedClient(trainer.id);
    const ratingOnly = await connectedClient(trainer.id);

    expect(
      (await postReview(trainer.id, withText.token, {
        rating: 5,
        reviewText: "Excellent trainer, very attentive.",
      })).status
    ).toBe(201);
    // No reviewText — this is the case that used to inflate reviewCount while
    // leaving totalRating untouched.
    expect((await postReview(trainer.id, ratingOnly.token, { rating: 3 })).status).toBe(201);

    const updated = await Trainer.findByPk(trainer.id);
    expect(updated!.reviewCount).toBe(2);
    expect(Number(updated!.totalRating)).toBeCloseTo(4, 2);
  });

  it("starts an unreviewed trainer at the prior, so a 1-star is never a promotion", async () => {
    const { trainer } = await createTestTrainer();
    const { token } = await connectedClient(trainer.id);

    const before = await Trainer.findByPk(trainer.id);
    expect(Number(before!.rankingScore)).toBeCloseTo(RATING_PRIOR, 2);

    await postReview(trainer.id, token, { rating: 1, reviewText: "Not a good fit for me." });

    const after = await Trainer.findByPk(trainer.id);
    expect(Number(after!.rankingScore)).toBeLessThan(Number(before!.rankingScore));
  });

  it("stores a shrunk ranking score alongside the honest average", async () => {
    const { trainer } = await createTestTrainer();
    const { token } = await connectedClient(trainer.id);

    await postReview(trainer.id, token, {
      rating: 5,
      reviewText: "Best trainer I have worked with.",
    });

    const updated = await Trainer.findByPk(trainer.id);
    expect(Number(updated!.totalRating)).toBeCloseTo(5, 2);
    // One 5-star must not rank as a 5.0 profile.
    expect(Number(updated!.rankingScore)).toBeCloseTo(shrinkRating(5, 1), 2);
    expect(Number(updated!.rankingScore)).toBeLessThan(5);
  });
});
