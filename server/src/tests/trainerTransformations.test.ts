import "./withDatabase";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Keep sharp and object storage out of the test: every photo "processes" to the
// same bytes and "uploads" to a predictable URL.
const uploadImage = jest.fn<(buf: Buffer, key: string) => Promise<{ url: string }>>();
const deleteImagesByUrl = jest.fn<(urls: unknown[]) => Promise<void>>();
jest.mock("../services/s3ImageService", () => ({
  S3ImageService: {
    uploadImage: (buf: Buffer, key: string) => uploadImage(buf, key),
    deleteImagesByUrl: (urls: unknown[]) => deleteImagesByUrl(urls),
  },
}));
jest.mock("../services/imageProcessor", () => ({
  processGalleryImage: async (input: Buffer) => ({
    buffer: input,
    contentType: "image/jpeg",
  }),
}));

import request from "supertest";
import { app } from "../index";
import { createTestUser, createTestTrainer } from "./helpers";
import { TrainerTransformation } from "../models/trainerTransformation";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

function postTransformation(token: string, fields: Record<string, string>) {
  let req = request(app)
    .post("/trainer-transformations")
    .set("Authorization", `Bearer ${token}`)
    .attach("before", JPEG, { filename: "before.jpg", contentType: "image/jpeg" })
    .attach("after", JPEG, { filename: "after.jpg", contentType: "image/jpeg" });
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  return req;
}

describe("Trainer Transformations API", () => {
  beforeEach(() => {
    let n = 0;
    uploadImage.mockReset();
    uploadImage.mockImplementation(async () => ({
      url: `https://cdn.example.com/trainer-transformation/${++n}.jpg`,
    }));
    deleteImagesByUrl.mockReset();
    deleteImagesByUrl.mockResolvedValue(undefined);
  });

  it("creates a transformation with both photos and a description", async () => {
    const { token, trainer } = await createTestTrainer();

    const res = await postTransformation(token, {
      description: "  −12 kg în 4 luni  ",
      consent: "true",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe("−12 kg în 4 luni");
    expect(res.body.data.beforeImageUrl).toMatch(/^https:\/\/cdn\.example\.com\//);
    expect(res.body.data.afterImageUrl).toMatch(/^https:\/\/cdn\.example\.com\//);
    expect(res.body.data.beforeImageUrl).not.toBe(res.body.data.afterImageUrl);
    expect(await TrainerTransformation.count({ where: { trainerId: trainer.id } })).toBe(1);
  });

  it("rejects a request without the consent confirmation", async () => {
    const { token } = await createTestTrainer();
    const res = await postTransformation(token, { description: "-5 kg" });
    expect(res.status).toBe(400);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("rejects an empty or too-long description", async () => {
    const { token } = await createTestTrainer();
    const empty = await postTransformation(token, { description: "   ", consent: "true" });
    expect(empty.status).toBe(400);
    const long = await postTransformation(token, {
      description: "x".repeat(201),
      consent: "true",
    });
    expect(long.status).toBe(400);
  });

  it("rejects a request missing the after photo", async () => {
    const { token } = await createTestTrainer();
    const res = await request(app)
      .post("/trainer-transformations")
      .set("Authorization", `Bearer ${token}`)
      .attach("before", JPEG, { filename: "before.jpg", contentType: "image/jpeg" })
      .field("description", "-5 kg")
      .field("consent", "true");
    expect(res.status).toBe(400);
  });

  it("caps a trainer at 5 transformations", async () => {
    const { token } = await createTestTrainer();
    for (let i = 0; i < 5; i++) {
      const ok = await postTransformation(token, { description: `#${i}`, consent: "true" });
      expect(ok.status).toBe(201);
    }
    const sixth = await postTransformation(token, { description: "#6", consent: "true" });
    expect(sixth.status).toBe(422);
  });

  it("drops the uploaded photo when the other one fails", async () => {
    const { token, trainer } = await createTestTrainer();
    uploadImage
      .mockImplementationOnce(async () => ({ url: "https://cdn.example.com/ok.jpg" }))
      .mockImplementationOnce(async () => {
        throw new Error("R2 unavailable");
      });

    const res = await postTransformation(token, { description: "-5 kg", consent: "true" });

    expect(res.status).toBe(422);
    expect(deleteImagesByUrl).toHaveBeenCalledWith(["https://cdn.example.com/ok.jpg", null]);
    expect(await TrainerTransformation.count({ where: { trainerId: trainer.id } })).toBe(0);
  });

  it("rejects a client who is not a trainer", async () => {
    const { token } = await createTestUser();
    const res = await postTransformation(token, { description: "-5 kg", consent: "true" });
    expect(res.status).toBe(403);
  });

  it("lists only the trainer's own transformations", async () => {
    const a = await createTestTrainer();
    const b = await createTestTrainer();
    await postTransformation(a.token, { description: "A", consent: "true" });
    await postTransformation(b.token, { description: "B", consent: "true" });

    const res = await request(app)
      .get("/trainer-transformations")
      .set("Authorization", `Bearer ${a.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((t: { description: string }) => t.description)).toEqual(["A"]);
  });

  it("deletes its own transformation and both stored photos", async () => {
    const { token } = await createTestTrainer();
    const created = await postTransformation(token, { description: "-5 kg", consent: "true" });
    const { id, beforeImageUrl, afterImageUrl } = created.body.data;

    const res = await request(app)
      .delete(`/trainer-transformations/${id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await TrainerTransformation.findByPk(id)).toBeNull();
    expect(deleteImagesByUrl).toHaveBeenCalledWith([beforeImageUrl, afterImageUrl]);
  });

  it("refuses to delete another trainer's transformation", async () => {
    const owner = await createTestTrainer();
    const other = await createTestTrainer();
    const created = await postTransformation(owner.token, { description: "-5 kg", consent: "true" });

    const res = await request(app)
      .delete(`/trainer-transformations/${created.body.data.id}`)
      .set("Authorization", `Bearer ${other.token}`);

    expect(res.status).toBe(404);
    expect(await TrainerTransformation.findByPk(created.body.data.id)).not.toBeNull();
  });

  it("shows transformations on the public trainer profile", async () => {
    const { token, trainer } = await createTestTrainer();
    await postTransformation(token, { description: "-12 kg in 4 luni", consent: "true" });

    const res = await request(app).get(`/trainer/${trainer.id}`);

    expect(res.status).toBe(200);
    expect(res.body.transformations).toHaveLength(1);
    expect(res.body.transformations[0].description).toBe("-12 kg in 4 luni");
  });
});
