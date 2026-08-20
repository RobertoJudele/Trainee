import { formatTime, formatDate, formatDateTime } from "../datetime";

// 18:00 in Bucharest during summer (UTC+3).
const evening = new Date("2026-08-21T15:00:00Z");

describe("formatTime", () => {
  it("uses 24-hour time, never AM/PM", () => {
    // The bug this exists to prevent: an English-locale phone rendered an 18:00
    // session as "06:00 PM".
    expect(formatTime(evening, "ro")).not.toMatch(/AM|PM/i);
    expect(formatTime(evening, "en")).not.toMatch(/AM|PM/i);
  });

  it("formats the same in both languages", () => {
    // Both target locales are 24-hour, so the time itself must not shift.
    expect(formatTime(evening, "en")).toBe(formatTime(evening, "ro"));
  });

  it("ignores the device locale entirely", () => {
    // No locale passed still means a fixed format, not the phone's.
    expect(formatTime(evening)).not.toMatch(/AM|PM/i);
  });

  it("returns empty for unusable input rather than 'Invalid Date'", () => {
    expect(formatTime("not a date")).toBe("");
    expect(formatTime(NaN)).toBe("");
  });
});

describe("formatDate", () => {
  it("puts the day before the month in both languages", () => {
    // en-GB, not en-US: a Romanian product must not render 21 August as 8/21.
    expect(formatDate(evening, "ro")).toMatch(/^21/);
    expect(formatDate(evening, "en")).toMatch(/^21/);
  });
});

describe("formatDateTime", () => {
  it("combines date and 24-hour time", () => {
    const out = formatDateTime(evening, "ro");
    expect(out).toMatch(/^21/);
    expect(out).not.toMatch(/AM|PM/i);
    expect(out).toContain(",");
  });
});
