/**
 * baseQueryWithReauth: what a 401 is allowed to do to the rest of the cache.
 *
 * A 401 used to log out and reset the whole API state even when the request
 * carried no session at all. For a logged-out user on a trainer profile that
 * reset re-mounted every query on screen, the block-list query 401'd again, and
 * each lap re-fetched /trainer/:id until the public rate limit answered 429 —
 * "Nu s-au putut încărca detaliile antrenorului".
 */
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../../constants/config", () => ({ API_URL: "https://api.test" }));

import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "../apiSlice";
import authReducer, { setCredentials, User } from "../../../features/auth/authSlice";
import { trainerApiSlice } from "../../../features/trainer/trainerApiSlice";
import { blockApiSlice } from "../../../features/block/blockApiSlice";

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

type TestStore = ReturnType<typeof makeStore>;

// The public trainer profile loads; the block list needs a session and 401s.
beforeEach(() => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/blocks") {
      return json(401, { success: false, message: "User is not authenticated" });
    }
    return json(200, { id: "abc", internalId: 34 });
  }) as unknown as typeof fetch;
});

// The trainer profile screen: load the trainer, then ask for the block list.
const openTrainerProfile = async (store: TestStore) => {
  const trainer = store.dispatch(trainerApiSlice.endpoints.getTrainerById.initiate("abc"));
  await trainer;
  const blocks = store.dispatch(blockApiSlice.endpoints.getBlockedUsers.initiate());
  await blocks;
  trainer.unsubscribe();
  blocks.unsubscribe();
};

const cachedTrainer = (store: TestStore) =>
  trainerApiSlice.endpoints.getTrainerById.select("abc")(store.getState()).data;

describe("baseQueryWithReauth on a 401", () => {
  it("leaves the cache alone when the request carried no session", async () => {
    const store = makeStore();

    await openTrainerProfile(store);

    expect(cachedTrainer(store)?.internalId).toBe(34);
    store.dispatch(apiSlice.util.resetApiState());
  });

  it("still logs out and clears the cache when a session cannot be refreshed", async () => {
    const store = makeStore();
    store.dispatch(
      setCredentials({ user: { id: 1 } as User, token: "expired", refreshToken: null })
    );

    await openTrainerProfile(store);

    expect(store.getState().auth.token).toBeNull();
    expect(cachedTrainer(store)).toBeUndefined();
  });
});
