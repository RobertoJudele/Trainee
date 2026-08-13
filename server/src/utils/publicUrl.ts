/**
 * The public website's base URL, from PUBLIC_WEB_URL.
 *
 * Empty until a consumer domain exists. Callers must treat the empty case as
 * "no public URL yet" rather than falling back to the API host: the API host
 * serves the pages too, but a link built on it would break the day the real
 * domain arrives, and those links end up in Instagram bios.
 */
export const publicWebBaseUrl = (): string =>
  (process.env.PUBLIC_WEB_URL || "").trim().replace(/\/+$/, "");

/**
 * Absolute URL of a trainer's public page, or null when either the domain or
 * the slug is missing. Served to the app rather than assembled there, so
 * changing PUBLIC_WEB_URL moves every link without a store release.
 */
export const trainerPublicUrl = (slug?: string | null): string | null => {
  const base = publicWebBaseUrl();
  const trimmed = (slug ?? "").trim();
  return base && trimmed ? `${base}/t/${encodeURIComponent(trimmed)}` : null;
};
