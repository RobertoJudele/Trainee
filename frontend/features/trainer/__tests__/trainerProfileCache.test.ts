/**
 * The trainer's own profile screen copies GET /trainer into the auth slice each
 * time it mounts. If saving with PUT /trainer leaves that cached GET untouched,
 * the next mount writes the pre-save profile back over the saved one, and the
 * edit form opens with the old values — the contact-button name came back empty
 * on the second edit.
 */
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../../../src/constants/config", () => ({ API_URL: "https://api.test" }));

import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "../../../src/api/apiSlice";
import authReducer from "../../auth/authSlice";
import { trainerApiSlice } from "../trainerApiSlice";

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const makeStore = () =>
  configureStore({
    reducer: { [apiSlice.reducerPath]: apiSlice.reducer, auth: authReducer },
    middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
  });

describe("own trainer profile cache", () => {
  it("serves the saved values after PUT /trainer", async () => {
    // A tiny fake server holding one trainer.
    let stored: Record<string, unknown> = { slug: "robi", contactNameDative: null };
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      if (request.method === "PUT") {
        stored = { ...stored, ...(await request.json()) };
      }
      return json(200, { success: true, message: "ok", data: stored });
    }) as unknown as typeof fetch;

    const store = makeStore();
    const profile = store.dispatch(trainerApiSlice.endpoints.getTrainerProfile.initiate());
    await profile;

    await store
      .dispatch(trainerApiSlice.endpoints.updateTrainerProfile.initiate({ contactNameDative: "lui Robi" }))
      .unwrap();
    // Let any refetch the save triggered settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.all(store.dispatch(apiSlice.util.getRunningQueriesThunk()));

    const cached = trainerApiSlice.endpoints.getTrainerProfile.select()(store.getState()).data;
    expect(cached?.data?.contactNameDative).toBe("lui Robi");
    profile.unsubscribe();
  });
});
