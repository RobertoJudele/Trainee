import { describe, it, expect, afterEach } from "@jest/globals";
import { publicWebBaseUrl, trainerPublicUrl } from "../utils/publicUrl";

const original = process.env.PUBLIC_WEB_URL;

afterEach(() => {
  if (original === undefined) delete process.env.PUBLIC_WEB_URL;
  else process.env.PUBLIC_WEB_URL = original;
});

describe("publicWebBaseUrl", () => {
  it("strips trailing slashes so joined paths never double up", () => {
    process.env.PUBLIC_WEB_URL = "https://salvio.juroc.tech/";
    expect(publicWebBaseUrl()).toBe("https://salvio.juroc.tech");
    process.env.PUBLIC_WEB_URL = "https://salvio.juroc.tech///";
    expect(publicWebBaseUrl()).toBe("https://salvio.juroc.tech");
  });

  it("is empty when unset", () => {
    delete process.env.PUBLIC_WEB_URL;
    expect(publicWebBaseUrl()).toBe("");
  });
});

describe("trainerPublicUrl", () => {
  it("builds the absolute page URL", () => {
    process.env.PUBLIC_WEB_URL = "https://salvio.juroc.tech";
    expect(trainerPublicUrl("andrei-popescu")).toBe(
      "https://salvio.juroc.tech/t/andrei-popescu"
    );
  });

  it("returns null before a public domain is configured", () => {
    // The app hides the share action on null rather than assembling a link from
    // the API host, which would break the day the real domain arrives — and
    // those links live in Instagram bios.
    delete process.env.PUBLIC_WEB_URL;
    expect(trainerPublicUrl("andrei-popescu")).toBeNull();
  });

  it("returns null when the trainer has no slug", () => {
    process.env.PUBLIC_WEB_URL = "https://salvio.juroc.tech";
    expect(trainerPublicUrl(null)).toBeNull();
    expect(trainerPublicUrl(undefined)).toBeNull();
    expect(trainerPublicUrl("   ")).toBeNull();
  });
});
