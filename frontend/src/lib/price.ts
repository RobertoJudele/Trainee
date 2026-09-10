/**
 * "From 110 lei/session" — the cheapest per-session price a trainer offers, which the
 * backend computes as the best price/session_count across their packages (falling back
 * to their flat session rate).
 *
 * Postgres numerics arrive as strings with trailing zeros ("110.00"), so the value is
 * normalised before it goes into the copy. Returns null when there is no price to show,
 * letting each caller pick its own placeholder.
 */
export const formatFromPerSession = (
  value: string | number | null | undefined,
  t: (key: string) => string
): string | null => {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return null;
  return t("fromPerSession").replace("%s", String(Math.round(price * 100) / 100));
};
