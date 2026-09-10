import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock the S3 client before importing anything that reaches for it, so the
// erasure helpers can be exercised without touching real object storage.
const send = jest.fn<(cmd: unknown) => Promise<unknown>>();
jest.mock("../config/s3", () => ({
  s3: { send: (cmd: unknown) => send(cmd) },
  S3_CONFIG: { bucket: "test-bucket", baseUrl: "https://cdn.example.com" },
}));

import sequelize from "../db";
import { TrainerImage } from "../models/trainerImage";
import { cascadeDeleteTrainer } from "../controllers/trainer";
import { S3ImageService } from "../services/s3ImageService";
import { createTestTrainer } from "./helpers";

// Deleting a row only drops the pointer; the object stays in a publicly served
// bucket and stays fetchable by anyone holding the URL. These tests guard the
// seam that makes account deletion reach storage — if cascadeDeleteTrainer stops
// handing back the URLs, the leak returns silently and nothing else fails.
describe("image erasure on deletion", () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ Errors: [] });
  });

  it("cascadeDeleteTrainer returns the image urls it deleted rows for", async () => {
    const { trainer } = await createTestTrainer();
    await TrainerImage.create({
      trainerId: trainer.id,
      imageUrl: "https://cdn.example.com/trainer/9/gallery-a.jpg",
      imageType: "gallery",
    } as never);
    await TrainerImage.create({
      trainerId: trainer.id,
      imageUrl: "https://cdn.example.com/trainer/9/credential-b.jpg",
      imageType: "credential",
    } as never);

    const urls = await sequelize.transaction((t) =>
      cascadeDeleteTrainer(trainer.id, t)
    );

    expect(urls.sort()).toEqual([
      "https://cdn.example.com/trainer/9/credential-b.jpg",
      "https://cdn.example.com/trainer/9/gallery-a.jpg",
    ]);
    // and the rows really are gone
    expect(await TrainerImage.count({ where: { trainerId: trainer.id } })).toBe(0);
  });

  it("returns an empty list for a trainer with no images", async () => {
    const { trainer } = await createTestTrainer();
    const urls = await sequelize.transaction((t) =>
      cascadeDeleteTrainer(trainer.id, t)
    );
    expect(urls).toEqual([]);
  });

  it("deleteImagesByUrl turns urls into unique object keys", async () => {
    await S3ImageService.deleteImagesByUrl([
      "https://cdn.example.com/trainer/9/a.jpg",
      "https://cdn.example.com/trainer/9/a.jpg", // duplicate
      "https://cdn.example.com/profilePicture/4/avatar.jpg",
      null,
      undefined,
      "",
    ]);

    expect(send).toHaveBeenCalledTimes(1);
    const cmd = send.mock.calls[0][0] as { input: { Delete: { Objects: { Key: string }[] } } };
    const keys = cmd.input.Delete.Objects.map((o) => o.Key).sort();
    expect(keys).toEqual(["profilePicture/4/avatar.jpg", "trainer/9/a.jpg"]);
  });

  it("deleteImagesByUrl does nothing when there is nothing to delete", async () => {
    await S3ImageService.deleteImagesByUrl([null, undefined, ""]);
    expect(send).not.toHaveBeenCalled();
  });

  // The account row is already gone by the time these run, so a storage outage
  // must not turn a completed deletion into a 500.
  it("never throws when storage fails", async () => {
    send.mockRejectedValue(new Error("R2 unavailable"));
    await expect(
      S3ImageService.deleteImagesByUrl(["https://cdn.example.com/trainer/9/a.jpg"])
    ).resolves.toBeUndefined();
    await expect(
      S3ImageService.deleteImagesByPrefix("profilePicture/4/")
    ).resolves.toBeUndefined();
  });
});
