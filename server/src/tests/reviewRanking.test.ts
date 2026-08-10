import { describe, it, expect } from "@jest/globals";
import { RATING_PRIOR, shrinkRating } from "../utils/rating";

// The one property that matters: a pile of fake 5-stars must not outrank a
// trainer with real volume until the pile gets implausibly large.
describe("shrinkRating", () => {
  it("keeps a veteran above a trainer with a handful of perfect reviews", () => {
    const veteran = shrinkRating(4.7, 200);
    expect(shrinkRating(5, 3)).toBeLessThan(veteran);
    expect(shrinkRating(5, 10)).toBeLessThan(veteran);
  });

  it("lets real volume eventually win", () => {
    expect(shrinkRating(5, 200)).toBeGreaterThan(shrinkRating(4.7, 200));
  });

  it("sits at the prior with no reviews", () => {
    expect(shrinkRating(0, 0)).toBeCloseTo(RATING_PRIOR);
  });

  it("never leaves the 1-5 range", () => {
    for (const [mean, count] of [[5, 1], [1, 1], [5, 1000], [1, 1000]] as const) {
      const score = shrinkRating(mean, count);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(5);
    }
  });
});
