// Bayesian shrinkage for search ranking. A trainer's rating is pulled toward the
// platform mean until enough reviews back it up, so a handful of fake 5-stars from
// throwaway accounts can't outrank a trainer with real volume. Raise PRIOR_WEIGHT
// if fakes still surface; it is roughly the number of reviews needed to earn your
// own mean. ponytail: no fraud detection, just a payoff too small to be worth it.
export const RATING_PRIOR = 4.3;
export const RATING_PRIOR_WEIGHT = 10;

export const shrinkRating = (mean: number, count: number): number =>
  (RATING_PRIOR * RATING_PRIOR_WEIGHT + mean * count) / (RATING_PRIOR_WEIGHT + count);
