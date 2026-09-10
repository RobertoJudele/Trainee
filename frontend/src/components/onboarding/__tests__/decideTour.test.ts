import { decideTour } from "../decideTour";

const base = {
  userId: 42,
  role: "client",
  pendingTrainerTourUserId: null as number | null,
  clientDone: false,
  trainerDone: false,
};

describe("decideTour", () => {
  it("starts the client tour for a new client", () => {
    expect(decideTour(base)).toBe("client");
  });

  it("starts the trainer tour for the user who just created a trainer profile", () => {
    expect(
      decideTour({ ...base, role: "trainer", pendingTrainerTourUserId: 42 })
    ).toBe("trainer");
  });

  it("does not repeat a finished tour", () => {
    expect(decideTour({ ...base, clientDone: true })).toBeNull();
    expect(
      decideTour({
        ...base,
        role: "trainer",
        pendingTrainerTourUserId: 42,
        trainerDone: true,
      })
    ).toBeNull();
  });

  it("never shows the trainer tour to a client", () => {
    // The reported bug: a trainer abandoned the tour, logged out, and signed up
    // as a client — the persisted flag then started the trainer walkthrough on
    // the brand-new client account.
    expect(
      decideTour({ ...base, userId: 99, role: "client", pendingTrainerTourUserId: 42 })
    ).toBe("client");
  });

  it("ignores a pending request left by a different user", () => {
    expect(
      decideTour({ ...base, userId: 99, role: "trainer", pendingTrainerTourUserId: 42 })
    ).toBeNull();
  });

  it("shows nothing to a trainer who never requested the tour", () => {
    // Signing back in as an existing trainer is not a first run.
    expect(decideTour({ ...base, role: "trainer" })).toBeNull();
  });

  it("shows nothing when signed out", () => {
    expect(decideTour({ ...base, userId: null })).toBeNull();
    expect(decideTour({ ...base, userId: undefined })).toBeNull();
  });

  it("shows nothing for an unknown role", () => {
    expect(decideTour({ ...base, role: "admin" })).toBeNull();
    expect(decideTour({ ...base, role: null })).toBeNull();
  });
});
