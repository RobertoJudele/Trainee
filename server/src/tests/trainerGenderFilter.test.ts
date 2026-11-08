import "./withDatabase";
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestUser, createTestTrainer } from "./helpers";
import { User } from "../models/user";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const setGender = (token: string, gender: string) =>
  request(app).put("/trainer").set(auth(token)).send({ gender });

const searchIds = async (query = "") => {
  const res = await request(app).get(`/trainer/search${query}`);
  expect(res.status).toBe(200);
  return res.body.data.trainers.map((t: { internalId: number }) => t.internalId);
};

describe("trainer gender", () => {
  it("is saved on the account by PUT /trainer and returned by GET /trainer", async () => {
    const { token, user } = await createTestTrainer();

    const put = await setGender(token, "female");
    expect(put.status).toBe(200);
    expect(put.body.data.gender).toBe("female");

    const self = await request(app).get("/trainer").set(auth(token));
    expect(self.body.data.gender).toBe("female");
    expect((await User.findByPk(user.id))?.sex).toBe("female");
  });

  it("is set when a client becomes a trainer", async () => {
    const { token, user } = await createTestUser();

    const res = await request(app)
      .post("/trainer/create")
      .set(auth(token))
      .send({ bio: "Antrenez de 5 ani", gender: "male" });

    expect(res.status).toBeLessThan(300);
    expect((await User.findByPk(user.id))?.sex).toBe("male");
  });

  it("rejects a value other than male or female", async () => {
    const { token } = await createTestTrainer();
    expect((await setGender(token, "other")).status).toBe(400);
    expect((await request(app).get("/trainer/search?gender=other")).status).toBe(400);
  });
});

describe("GET /trainer/search?gender=", () => {
  it("returns only trainers of that gender and hides those without one", async () => {
    const woman = await createTestTrainer();
    const man = await createTestTrainer();
    const unset = await createTestTrainer();
    await setGender(woman.token, "female");
    await setGender(man.token, "male");

    const female = await searchIds("?gender=female");
    expect(female).toContain(woman.trainer.id);
    expect(female).not.toContain(man.trainer.id);
    expect(female).not.toContain(unset.trainer.id);

    const male = await searchIds("?gender=male");
    expect(male).toContain(man.trainer.id);
    expect(male).not.toContain(woman.trainer.id);

    const all = await searchIds();
    expect(all).toEqual(expect.arrayContaining([woman.trainer.id, man.trainer.id, unset.trainer.id]));
  });
});
