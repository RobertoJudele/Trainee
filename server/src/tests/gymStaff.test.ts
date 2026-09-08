import { describe, it, expect } from "@jest/globals";
import { TrainerGym } from "../models/trainerGym";
import { createTestGym, createTestTrainer } from "./helpers";

describe("trainer_gyms staff columns", () => {
  it("defaults a new affiliation to 'none' with no review metadata", async () => {
    const { trainer } = await createTestTrainer();
    const { gym } = await createTestGym();

    const row = await TrainerGym.create({
      trainerId: trainer.id,
      gymId: gym.id,
      isAvailable: true,
    });

    expect(row.staffStatus).toBe("none");
    expect(row.staffRequestedAt).toBeNull();
    expect(row.staffReviewedAt).toBeNull();
    expect(row.staffReviewedBy).toBeNull();
  });
});
