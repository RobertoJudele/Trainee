import { describe, it, expect } from "@jest/globals";
import { SALVIO_LOGO_DATA_URI } from "../services/posterLandingLogo";

describe("poster landing assets", () => {
  it("inlines a small logo", () => {
    expect(SALVIO_LOGO_DATA_URI.startsWith("data:image/png;base64,")).toBe(true);
    // The 730 KB source would be ~1 MB of base64 on every page load.
    expect(SALVIO_LOGO_DATA_URI.length).toBeLessThan(40_000);
  });
});
