/**
 * Slugs for public trainer pages: "Ștefan Popescu-Ionescu" → "stefan-popescu-ionescu".
 *
 * These end up in a URL a trainer puts in their Instagram bio, so they have to be
 * readable, stable, and free of anything that needs percent-encoding.
 *
 * Romanian note, same trap as `unaccentILike`: Windows keyboards still emit the
 * cedilla lookalikes ş/ţ (U+015F/U+0163) where the correct characters are the
 * comma-below ș/ț (U+0219/U+021B). Both decompose to a base letter plus a
 * combining mark, so stripping marks after NFD handles either spelling — and the
 * tests pin both, because a trainer typing their own name on Windows must not get
 * a different slug from one typing it on a phone.
 */

const MAX_SLUG_LENGTH = 60;

export const slugify = (value: string): string =>
  value
    .normalize("NFD")
    // Strip combining marks: ă→a, â→a, î→i, ș/ş→s, ț/ţ→t, plus every other accent.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // ß and đ do not decompose; spell them out rather than dropping them.
    .replace(/ß/g, "ss")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    // A trailing hyphen can reappear after the length cut.
    .replace(/-+$/g, "");

/**
 * Builds the slug for a trainer, falling back to the public id when the name
 * yields nothing usable — a name written entirely in a non-Latin script would
 * otherwise produce an empty slug and a broken URL.
 */
export const trainerSlugBase = (
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  publicId: string
): string => {
  const fromName = slugify(`${firstName ?? ""} ${lastName ?? ""}`);
  return fromName || `antrenor-${publicId.slice(0, 8)}`;
};

/**
 * Resolves collisions by suffixing: a second Andrei Popescu becomes
 * "andrei-popescu-2". `isTaken` is async so the caller can hit the database.
 *
 * Gives up after `maxAttempts` and falls back to a suffix that cannot collide,
 * rather than looping forever against a pathological dataset.
 */
export const makeUniqueSlug = async (
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 50
): Promise<string> => {
  if (!(await isTaken(base))) {
    return base;
  }

  for (let suffix = 2; suffix <= maxAttempts; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
};
