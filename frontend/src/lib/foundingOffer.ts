import type { FoundingGrantOffer } from "../../features/billing/billingApiSlice";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface FoundingOfferView {
  /** Whole days remaining, rounded up. 1 on the final day. */
  daysLeft: number;
  /** Free months the grant gives — served, never assumed to be 3. */
  months: number;
  /**
   * Romanian requires "de" before the noun when the last two digits of the
   * numeral are 00 or fall between 20 and 99: "3 zile" but "49 de zile", and
   * "101 zile" but "120 de zile". Getting this wrong reads as broken Romanian
   * to a native speaker, and RO is the default language.
   */
  needsDe: boolean;
}

/**
 * Turns the served offer into what the banner needs, or null when there is
 * nothing to show.
 *
 * Returns null — rather than a zero state — when the promo is closed, has no
 * deadline, or the deadline has passed, so the caller renders nothing at all.
 */
export const describeFoundingOffer = (
  offer: FoundingGrantOffer | undefined,
  now: Date = new Date()
): FoundingOfferView | null => {
  if (!offer?.isOpen || !offer.deadline || offer.months <= 0) {
    return null;
  }

  const deadline = new Date(offer.deadline);
  if (!Number.isFinite(deadline.getTime())) {
    return null;
  }

  const msLeft = deadline.getTime() - now.getTime();
  if (msLeft <= 0) {
    return null;
  }

  const daysLeft = Math.ceil(msLeft / DAY_MS);

  return { daysLeft, months: offer.months, needsDe: romanianNeedsDe(daysLeft) };
};

/** Exported for testing; see the note on `needsDe`. */
export const romanianNeedsDe = (value: number): boolean => {
  const lastTwo = Math.abs(value) % 100;
  return lastTwo === 0 || lastTwo >= 20;
};
