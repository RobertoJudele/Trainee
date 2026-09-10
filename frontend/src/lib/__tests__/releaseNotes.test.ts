import { shouldShowReleaseNotes, ReleaseNotes } from "../releaseNotes";

const notes: ReleaseNotes = {
  version: "1.1.0",
  title: "Profil public",
  body: "Ai acum o pagină web proprie.",
};

describe("shouldShowReleaseNotes", () => {
  it("shows after an update", () => {
    expect(
      shouldShowReleaseNotes({
        storedVersion: "1.0.0",
        currentVersion: "1.1.0",
        notes,
      })
    ).toBe(true);
  });

  it("stays silent on a fresh install", () => {
    // A brand-new user has no previous version, and must not be greeted by a
    // changelog for features they never lacked.
    expect(
      shouldShowReleaseNotes({
        storedVersion: null,
        currentVersion: "1.1.0",
        notes,
      })
    ).toBe(false);
  });

  it("stays silent on a second launch of the same version", () => {
    expect(
      shouldShowReleaseNotes({
        storedVersion: "1.1.0",
        currentVersion: "1.1.0",
        notes,
      })
    ).toBe(false);
  });

  it("stays silent when the server has no notes for this version", () => {
    expect(
      shouldShowReleaseNotes({
        storedVersion: "1.0.0",
        currentVersion: "1.1.0",
        notes: null,
      })
    ).toBe(false);
    expect(
      shouldShowReleaseNotes({
        storedVersion: "1.0.0",
        currentVersion: "1.1.0",
        notes: undefined,
      })
    ).toBe(false);
  });

  it("ignores notes that describe a different version", () => {
    // Never announce a release the user is not actually running.
    expect(
      shouldShowReleaseNotes({
        storedVersion: "1.0.0",
        currentVersion: "1.1.0",
        notes: { ...notes, version: "1.2.0" },
      })
    ).toBe(false);
  });

  it("stays silent when the running version is unknown", () => {
    expect(
      shouldShowReleaseNotes({
        storedVersion: "1.0.0",
        currentVersion: "",
        notes,
      })
    ).toBe(false);
  });
});
