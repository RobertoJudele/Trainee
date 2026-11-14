import "./withDatabase";
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { createTestTrainer } from "./helpers";

describe("free first session flag", () => {
  it("is off for a new trainer", async () => {
    const { token } = await createTestTrainer();
    const res = await request(app).get("/trainer").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.freeFirstSession).toBe(false);
  });

  it("is saved by PUT /trainer and shown on the profile and in search", async () => {
    const { token, trainer } = await createTestTrainer();

    const put = await request(app)
      .put("/trainer")
      .set("Authorization", `Bearer ${token}`)
      .send({ freeFirstSession: true });
    expect(put.status).toBe(200);
    expect(put.body.data.freeFirstSession).toBe(true);

    const self = await request(app).get("/trainer").set("Authorization", `Bearer ${token}`);
    expect(self.body.data.freeFirstSession).toBe(true);

    const pub = await request(app).get(`/trainer/${trainer.id}`);
    expect(pub.body.freeFirstSession).toBe(true);

    const search = await request(app).get("/trainer/search");
    const row = search.body.data.trainers.find(
      (t: { id: string }) => t.id === pub.body.id
    );
    expect(row?.freeFirstSession).toBe(true);
  });

  it("is left alone by an update that doesn't mention it", async () => {
    const { token } = await createTestTrainer();
    await request(app).put("/trainer").set("Authorization", `Bearer ${token}`).send({ freeFirstSession: true });

    await request(app).put("/trainer").set("Authorization", `Bearer ${token}`).send({ bio: "Bio nou" });

    const self = await request(app).get("/trainer").set("Authorization", `Bearer ${token}`);
    expect(self.body.data.freeFirstSession).toBe(true);
  });

  it("can be switched off again", async () => {
    const { token } = await createTestTrainer();
    await request(app).put("/trainer").set("Authorization", `Bearer ${token}`).send({ freeFirstSession: true });

    const put = await request(app)
      .put("/trainer")
      .set("Authorization", `Bearer ${token}`)
      .send({ freeFirstSession: false });

    expect(put.body.data.freeFirstSession).toBe(false);
  });

  it("filters search to trainers offering it, with or without a text query", async () => {
    const offering = await createTestTrainer({ firstName: "Gratis", lastName: "Oferta" });
    const notOffering = await createTestTrainer({ firstName: "Gratis", lastName: "Fara" });
    await request(app).put("/trainer").set("Authorization", `Bearer ${offering.token}`).send({ freeFirstSession: true });

    const ids = async (query: string) =>
      (await request(app).get(`/trainer/search${query}`)).body.data.trainers.map(
        (t: { internalId: number }) => t.internalId
      );

    const filtered = await ids("?freeFirstSession=true");
    expect(filtered).toContain(offering.trainer.id);
    expect(filtered).not.toContain(notOffering.trainer.id);

    const withText = await ids("?q=gratis&freeFirstSession=true");
    expect(withText).toContain(offering.trainer.id);
    expect(withText).not.toContain(notOffering.trainer.id);

    const all = await ids("?q=gratis");
    expect(all).toEqual(expect.arrayContaining([offering.trainer.id, notOffering.trainer.id]));
  });

  it("rejects a value that isn't a boolean", async () => {
    const { token } = await createTestTrainer();
    const res = await request(app)
      .put("/trainer")
      .set("Authorization", `Bearer ${token}`)
      .send({ freeFirstSession: "yes" });
    expect(res.status).toBe(400);
  });
});
