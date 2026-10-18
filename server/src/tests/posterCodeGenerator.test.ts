import { describe, it, expect } from "@jest/globals";
import { generatePosterCode, POSTER_CODE_PATTERN } from "../utils/posterCode";

describe("generatePosterCode", () => {
  it("returns a six-character code matching the accepted pattern", () => {
    const code = generatePosterCode();

    expect(code).toHaveLength(6);
    expect(POSTER_CODE_PATTERN.test(code)).toBe(true);
  });

  it("never emits visually ambiguous characters", () => {
    // A code is read off a poster and typed by hand often enough that 0/o and
    // 1/l/i are worth excluding outright.
    const codes = Array.from({ length: 200 }, () => generatePosterCode());

    for (const code of codes) {
      expect(code).not.toMatch(/[01oli]/);
    }
  });

  it("is random enough that 200 codes are essentially all distinct", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generatePosterCode()));

    expect(codes.size).toBeGreaterThan(190);
  });
});

describe("POSTER_CODE_PATTERN", () => {
  it("accepts a hand-written slug and rejects unsafe input", () => {
    expect(POSTER_CODE_PATTERN.test("wc-dorobanti")).toBe(true);
    expect(POSTER_CODE_PATTERN.test("ab")).toBe(false);
    expect(POSTER_CODE_PATTERN.test("Has-Upper")).toBe(false);
    expect(POSTER_CODE_PATTERN.test("has space")).toBe(false);
    expect(POSTER_CODE_PATTERN.test("../etc")).toBe(false);
  });
});
