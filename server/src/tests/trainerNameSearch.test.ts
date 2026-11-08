import "./withDatabase";
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestTrainer } from "./helpers";

const searchIds = async (q: string) => {
  const res = await request(app).get(`/trainer/search?q=${encodeURIComponent(q)}`);
  expect(res.status).toBe(200);
  return res.body.data.trainers.map((t: { internalId: number }) => t.internalId);
};

describe("searching trainers by name", () => {
  it("finds a trainer by first name, last name, or both together", async () => {
    const { trainer } = await createTestTrainer({ firstName: "Robi", lastName: "Judele" });

    expect(await searchIds("robi")).toContain(trainer.id);
    expect(await searchIds("judele")).toContain(trainer.id);
    expect(await searchIds("robi judele")).toContain(trainer.id);
    expect(await searchIds("Judele Robi")).toContain(trainer.id);
    expect(await searchIds("  robi   judele ")).toContain(trainer.id);
  });

  it("ignores diacritics in a two-word name", async () => {
    const { trainer } = await createTestTrainer({ firstName: "Ștefan", lastName: "Mărgărit" });
    expect(await searchIds("stefan margarit")).toContain(trainer.id);
  });

  it("does not match when one of the words belongs to nobody", async () => {
    const { trainer } = await createTestTrainer({ firstName: "Robi", lastName: "Judele" });
    expect(await searchIds("robi popescu")).not.toContain(trainer.id);
  });
});
