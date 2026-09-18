import { describe, it, expect } from "@jest/globals";
import { POSTER_TOKENS_CSS } from "../services/posterLandingTokens";
import { SALVIO_LOGO_DATA_URI } from "../services/posterLandingLogo";
import { POSTER_ICONS } from "../services/posterLandingIcons";

describe("poster landing assets", () => {
  it("carries the design-system tokens the page depends on", () => {
    expect(POSTER_TOKENS_CSS).toContain("--green-500:#12B177");
    expect(POSTER_TOKENS_CSS).toContain("--ink-900:#14181A");
    expect(POSTER_TOKENS_CSS).toContain("--shadow-brand");
    expect(POSTER_TOKENS_CSS).toContain("--font-display");
  });

  it("puts the font @import first, since a later @import is ignored", () => {
    expect(POSTER_TOKENS_CSS.trimStart().startsWith("/*")).toBe(true);
    const importIndex = POSTER_TOKENS_CSS.indexOf("@import");
    const firstRuleIndex = POSTER_TOKENS_CSS.indexOf(":root{");
    expect(importIndex).toBeGreaterThan(-1);
    expect(importIndex).toBeLessThan(firstRuleIndex);
  });

  it("inlines a small logo", () => {
    expect(SALVIO_LOGO_DATA_URI.startsWith("data:image/png;base64,")).toBe(true);
    // The 730 KB source would be ~1 MB of base64 on every page load.
    expect(SALVIO_LOGO_DATA_URI.length).toBeLessThan(40_000);
  });

  it("renders icons that inherit colour and carry no fixed fill", () => {
    for (const icon of Object.values(POSTER_ICONS)) {
      expect(icon).toContain('stroke="currentColor"');
      expect(icon).toContain('aria-hidden="true"');
    }
  });
});
