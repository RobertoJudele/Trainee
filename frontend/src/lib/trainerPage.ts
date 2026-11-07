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
  options: PriceOption[];
}

const roundLei = (value: number) => Math.round(value * 100) / 100;

/**
 * Builds the "de la X lei o ședință" summary from the single-session rate and the
 * packages. "de la" is only shown when there really are several prices, and X is
 * always the lowest of them, matching the server's minSessionPrice.
 */
export const summarizePrices = (
  sessionRate: number | string | null | undefined,
  packages: ReadonlyArray<{ name: string; price: number | string; sessionCount: number }>
): PriceSummary | null => {
  const options: PriceOption[] = [];
  const single = Number(sessionRate);
  if (Number.isFinite(single) && single > 0) {
    options.push({ kind: "single", sessions: 1, total: roundLei(single), perSession: roundLei(single) });
  }
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
  if (options.length === 0) return null;
  const lowest = Math.min(...options.map((o) => o.perSession));
  const showFrom = options.some((o) => o.perSession > lowest);
  return { lowest, showFrom, options };
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
 * "Scrie-i lui Andrei pe WhatsApp". The dative name is typed in at onboarding
 * (trainer.contactNameDative); without it the button drops the name rather than
 * guessing the grammar. English uses the first name, which needs no case.
 */
export const contactButtonLabel = (
  channel: ContactChannel,
  language: "en" | "ro",
  firstName: string,
  dativeName?: string | null
): string => {
  const app = CHANNEL_NAME[channel];
  if (language === "en") return firstName ? `Message ${firstName} on ${app}` : `Message on ${app}`;
  const dative = dativeName?.trim();
  return dative ? `Scrie-i ${dative} pe ${app}` : `Scrie pe ${app}`;
};
