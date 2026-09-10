/**
 * Date and time formatting for the UI.
 *
 * Two rules, both learned from bugs:
 *
 * 1. Never fall back to the device locale. `toLocaleTimeString([], ...)` follows
 *    the phone's language, so a Romanian user with an English phone saw "06:00 PM"
 *    for an 18:00 session.
 * 2. Always 24-hour. Romania uses it universally, and the session reminders sent
 *    from the server already do — the app must not disagree with its own push.
 */
export type AppLocale = string | null | undefined;

const intlLocale = (locale: AppLocale): string => (locale === "ro" ? "ro-RO" : "en-GB");

const toDate = (value: Date | string | number): Date | null => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

/** "18:00" */
export const formatTime = (value: Date | string | number, locale?: AppLocale): string => {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

/** "21.08.2026" */
export const formatDate = (value: Date | string | number, locale?: AppLocale): string => {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

/** "21.08.2026, 18:00" */
export const formatDateTime = (value: Date | string | number, locale?: AppLocale): string => {
  const date = toDate(value);
  if (!date) return "";
  return `${formatDate(date, locale)}, ${formatTime(date, locale)}`;
};
