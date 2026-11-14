/**
 * Pure helpers for the trainer page: the price summary and the bits of
 * Romanian grammar its copy needs. Kept out of the screen so they can be tested.
 */

export interface PriceOption {
  /** "single" is one session at the trainer's session rate; "package" is a pack. */
  kind: "single" | "package";
  name?: string;
  sessions: number;
  total: number;
  perSession: number;
}

export interface PriceSummary {
  /** The lowest price per session a client can actually book. */
  lowest: number;
  /** True when options differ, so the headline reads "de la X". One price, no "de la". */
  showFrom: boolean;
  /** With "de la": how many sessions the pack that gives the lowest rate holds. */
  lowestPackSessions: number | null;
  options: PriceOption[];
}

const roundLei = (value: number) => Math.round(value * 100) / 100;

/**
 * Builds the "de la X lei o ședință" summary. Packages are the prices; a single
 * session is a 1-session package. The flat session rate is a leftover trainers can
 * no longer edit, so it only counts when there are no packages at all, matching the
 * server's minSessionPrice. "de la" only when the packages differ per session.
 */
export const summarizePrices = (
  sessionRate: number | string | null | undefined,
  packages: ReadonlyArray<{ name: string; price: number | string; sessionCount: number }>
): PriceSummary | null => {
  const options: PriceOption[] = [];
  for (const pkg of packages) {
    const total = Number(pkg.price);
    if (!Number.isFinite(total) || total <= 0 || !(pkg.sessionCount > 0)) continue;
    options.push({
      kind: "package",
      name: pkg.name,
      sessions: pkg.sessionCount,
      total: roundLei(total),
      perSession: roundLei(total / pkg.sessionCount),
    });
  }
  if (options.length === 0) {
    const single = Number(sessionRate);
    if (!Number.isFinite(single) || single <= 0) return null;
    options.push({ kind: "single", sessions: 1, total: roundLei(single), perSession: roundLei(single) });
  }
  const lowest = Math.min(...options.map((o) => o.perSession));
  const showFrom = options.some((o) => o.perSession > lowest);
  const best = options.find((o) => o.perSession === lowest);
  const lowestPackSessions = showFrom && best && best.sessions > 1 ? best.sessions : null;
  return { lowest, showFrom, lowestPackSessions, options };
};

/** "120" or "112,5": lei amounts without trailing zeros, Romanian decimal comma. */
export const formatLei = (value: number, language: "en" | "ro"): string => {
  const text = String(roundLei(value));
  return language === "ro" ? text.replace(".", ",") : text;
};

/**
 * Romanian puts "de" between a number and its noun from 20 up ("23 de recenzii",
 * "5 recenzii", "101 recenzii", "120 de recenzii"): when the last two digits are
 * 0 or 20-99, for any number of 20 or more.
 */
export const roCount = (n: number, one: string, many: string): string => {
  if (n === 1) return `1 ${one}`;
  const lastTwo = n % 100;
  const needsDe = n >= 20 && (lastTwo === 0 || lastTwo >= 20);
  return `${n} ${needsDe ? "de " : ""}${many}`;
};

export type ContactChannel = "whatsapp" | "instagram" | "facebook";

const CHANNEL_NAME: Record<ContactChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
};

/**
 * "Scrie-i pe WhatsApp". No trainer name: next to the price and the second
 * contact icon a name truncated the button to "Scrie-i lui Andrei pe Whatsa…".
 */
export const contactButtonLabel = (channel: ContactChannel, language: "en" | "ro"): string => {
  const app = CHANNEL_NAME[channel];
  return language === "en" ? `Message on ${app}` : `Scrie-i pe ${app}`;
};
