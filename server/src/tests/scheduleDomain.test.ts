// Pure unit tests - no database, no HTTP, no env. Every rule asserted here
// previously lived inside an Express handler and could only be reached by
// driving the real API against real Postgres, which is why none of it was
// tested: trainerSchedule.test.ts drives 26 cases through supertest and
// asserts `count > 0`, never the arithmetic.
import { describe, it, expect } from "@jest/globals";
import {
  MAX_GENERATE_RANGE_DAYS,
  isFree,
  isProtected,
  overlaps,
  phaseOf,
  planPackConsume,
  planPackRefund,
  planSlots,
  selectPackToConsume,
  selectPackToRefund,
  shiftFromExplicitHours,
  validateGenerateRange,
  validateShift,
} from "../services/schedule/domain";
import { Interval, PackView, Shift } from "../services/schedule/types";

const utc = (iso: string): Date => new Date(iso);
const interval = (startIso: string, endIso: string): Interval => ({
  start: utc(startIso),
  end: utc(endIso),
});

describe("overlap rule", () => {
  it("treats intervals as half-open: touching is not overlapping", () => {
    const a = interval("2026-10-01T09:00:00Z", "2026-10-01T10:00:00Z");
    const b = interval("2026-10-01T10:00:00Z", "2026-10-01T11:00:00Z");
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(b, a)).toBe(false);
  });

  it("detects partial overlap from either side", () => {
    const booked = interval("2026-10-01T09:00:00Z", "2026-10-01T10:00:00Z");
    expect(overlaps(interval("2026-10-01T09:30:00Z", "2026-10-01T10:30:00Z"), booked)).toBe(true);
    expect(overlaps(interval("2026-10-01T08:30:00Z", "2026-10-01T09:30:00Z"), booked)).toBe(true);
  });

  it("detects containment in both directions", () => {
    const outer = interval("2026-10-01T09:00:00Z", "2026-10-01T12:00:00Z");
    const inner = interval("2026-10-01T10:00:00Z", "2026-10-01T11:00:00Z");
    expect(overlaps(inner, outer)).toBe(true);
    expect(overlaps(outer, inner)).toBe(true);
  });

  it("does not overlap a disjoint interval", () => {
    const a = interval("2026-10-01T09:00:00Z", "2026-10-01T10:00:00Z");
    const b = interval("2026-10-01T14:00:00Z", "2026-10-01T15:00:00Z");
    expect(overlaps(a, b)).toBe(false);
  });
});

describe("slot phase", () => {
  it("derives phase from whether a client holds the slot", () => {
    expect(phaseOf({ clientId: null })).toBe("free");
    expect(phaseOf({ clientId: 7 })).toBe("booked");
    expect(isFree({ clientId: null })).toBe(true);
    expect(isProtected({ clientId: 7 })).toBe(true);
    expect(isProtected({ clientId: null })).toBe(false);
  });
});

describe("planSlots", () => {
  const shift = (startMin: number, endMin: number, durationMin: number): Shift =>
    ({ startMin, endMin, durationMin, workingHourId: null });

  it("slices a shift into back-to-back slots", () => {
    const plan = planSlots({
      fromKey: "2026-10-01",
      toKey: "2026-10-01",
      timeZone: "UTC",
      shifts: [shift(9 * 60, 12 * 60, 60)],
      blockedKeys: new Set(),
      occupied: [],
    });

    expect(plan.create).toHaveLength(3);
    expect(plan.create[0].startsAt.toISOString()).toBe("2026-10-01T09:00:00.000Z");
    expect(plan.create[2].endsAt.toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });

  it("drops a trailing partial slot that would run past the shift end", () => {
    const plan = planSlots({
      fromKey: "2026-10-01",
      toKey: "2026-10-01",
      timeZone: "UTC",
      shifts: [shift(9 * 60, 10 * 60 + 30, 60)],
      blockedKeys: new Set(),
      occupied: [],
    });

    expect(plan.create).toHaveLength(1);
    expect(plan.create[0].endsAt.toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });

  // THE regression test for the bug this whole extraction exists to kill.
  // regenerateDay used to compare exact start instants, so regenerating a day
  // at a shorter duration created free slots straddling an already-booked
  // one: a booked 09:00-10:00 slot did not match the 09:30 start, so the
  // check passed and the client's paid session got double-booked.
  it("never plans a slot overlapping a booked one, even at a different duration", () => {
    const booked = interval("2026-10-01T09:00:00Z", "2026-10-01T10:00:00Z");

    const plan = planSlots({
      fromKey: "2026-10-01",
      toKey: "2026-10-01",
      timeZone: "UTC",
      shifts: [shift(9 * 60, 12 * 60, 30)], // 30-minute slots over a 60-minute booking
      blockedKeys: new Set(),
      occupied: [booked],
    });

    for (const planned of plan.create) {
      expect(overlaps({ start: planned.startsAt, end: planned.endsAt }, booked)).toBe(false);
    }
    // 09:00-10:00 is taken, so only 10:00-12:00 can be sliced: four 30s.
    expect(plan.create).toHaveLength(4);
    expect(plan.create[0].startsAt.toISOString()).toBe("2026-10-01T10:00:00.000Z");
    expect(plan.skipped.filter((s) => s.reason === "occupied")).toHaveLength(2);
  });

  it("does not plan two slots over each other within one run", () => {
    const plan = planSlots({
      fromKey: "2026-10-01",
      toKey: "2026-10-01",
      timeZone: "UTC",
      // Two shifts covering the same hours - the second must find the first's
      // slots already taken rather than duplicating them.
      shifts: [shift(9 * 60, 11 * 60, 60), shift(9 * 60, 11 * 60, 60)],
      blockedKeys: new Set(),
      occupied: [],
    });

    expect(plan.create).toHaveLength(2);
    expect(plan.skipped.filter((s) => s.reason === "occupied")).toHaveLength(2);
  });

  it("skips a blocked day and says why", () => {
    const plan = planSlots({
      fromKey: "2026-10-01",
      toKey: "2026-10-02",
      timeZone: "UTC",
      shifts: [shift(9 * 60, 11 * 60, 60)],
      blockedKeys: new Set(["2026-10-01"]),
      occupied: [],
    });

    expect(plan.create).toHaveLength(2); // only the 2nd
    expect(plan.create[0].startsAt.toISOString()).toBe("2026-10-02T09:00:00.000Z");
    expect(plan.skipped.some((s) => s.reason === "blocked")).toBe(true);
  });

  it("picks shifts per weekday when keyed by weekday", () => {
    // 2026-10-01 is a Thursday (4), 2026-10-02 a Friday (5).
    const plan = planSlots({
      fromKey: "2026-10-01",
      toKey: "2026-10-02",
      timeZone: "UTC",
      shiftsByWeekday: new Map([[4, [shift(9 * 60, 10 * 60, 60)]]]),
      blockedKeys: new Set(),
      occupied: [],
    });

    expect(plan.create).toHaveLength(1);
    expect(plan.create[0].startsAt.toISOString()).toBe("2026-10-01T09:00:00.000Z");
  });

  it("keeps a trainer's wall-clock hours across a DST transition", () => {
    // Europe/Bucharest leaves DST on 2026-10-25 (03:00 -> 02:00). A 09:00
    // local shift must stay 09:00 local on both sides, which means the UTC
    // instant shifts by an hour.
    const before = planSlots({
      fromKey: "2026-10-24",
      toKey: "2026-10-24",
      timeZone: "Europe/Bucharest",
      shifts: [shift(9 * 60, 10 * 60, 60)],
      blockedKeys: new Set(),
      occupied: [],
    });
    const after = planSlots({
      fromKey: "2026-10-26",
      toKey: "2026-10-26",
      timeZone: "Europe/Bucharest",
      shifts: [shift(9 * 60, 10 * 60, 60)],
      blockedKeys: new Set(),
      occupied: [],
    });

    // EEST (UTC+3) before, EET (UTC+2) after.
    expect(before.create[0].startsAt.toISOString()).toBe("2026-10-24T06:00:00.000Z");
    expect(after.create[0].startsAt.toISOString()).toBe("2026-10-26T07:00:00.000Z");
  });

  it("still produces a full day of slots on a DST-shortened day", () => {
    // Spring forward: 2026-03-29 in Europe/Bucharest loses an hour at 03:00,
    // but a 09:00-17:00 shift is untouched by it.
    const plan = planSlots({
      fromKey: "2026-03-29",
      toKey: "2026-03-29",
      timeZone: "Europe/Bucharest",
      shifts: [shift(9 * 60, 17 * 60, 60)],
      blockedKeys: new Set(),
      occupied: [],
    });
    expect(plan.create).toHaveLength(8);
  });
});

describe("shift validation", () => {
  it("rejects an end at or before the start", () => {
    expect(validateShift(shiftFromExplicitHours("10:00", "10:00", 60)).ok).toBe(false);
    expect(validateShift(shiftFromExplicitHours("11:00", "10:00", 60)).ok).toBe(false);
  });

  it("rejects a non-positive duration", () => {
    expect(validateShift(shiftFromExplicitHours("09:00", "10:00", 0)).ok).toBe(false);
  });

  it("accepts a sane shift", () => {
    expect(validateShift(shiftFromExplicitHours("09:00", "17:00", 45)).ok).toBe(true);
  });
});

describe("generate range validation", () => {
  it("rejects a backwards range", () => {
    expect(validateGenerateRange("2026-10-05", "2026-10-01").ok).toBe(false);
  });

  it("accepts a range exactly at the limit and rejects one past it", () => {
    const from = "2026-01-01";
    const at = `2026-01-01`;
    expect(validateGenerateRange(from, at).ok).toBe(true);
    // 62 days inclusive-of-span, then one more.
    const okEnd = "2026-03-04"; // 62 days after Jan 1
    expect(validateGenerateRange(from, okEnd).ok).toBe(true);
    const tooFar = "2026-03-05"; // 63
    expect(validateGenerateRange(from, tooFar).ok).toBe(false);
    expect(MAX_GENERATE_RANGE_DAYS).toBe(62);
  });
});

describe("session packs", () => {
  const pack = (id: number, total: number, used: number, createdIso: string): PackView => ({
    id,
    totalSessions: total,
    usedSessions: used,
    createdAt: utc(createdIso),
  });

  it("consumes from the oldest pack that still has room", () => {
    const packs = [
      pack(2, 10, 10, "2026-01-01T00:00:00Z"), // oldest but full
      pack(3, 5, 1, "2026-02-01T00:00:00Z"), // oldest with room
      pack(4, 5, 0, "2026-03-01T00:00:00Z"),
    ];
    expect(selectPackToConsume(packs)?.id).toBe(3);
    expect(planPackConsume(packs)).toEqual({ kind: "consumed", packId: 3, usedSessions: 2 });
  });

  it("refunds to the newest pack that has a used session", () => {
    const packs = [
      pack(2, 10, 4, "2026-01-01T00:00:00Z"),
      pack(3, 5, 2, "2026-02-01T00:00:00Z"), // newest with a used session
      pack(4, 5, 0, "2026-03-01T00:00:00Z"), // newest but nothing used
    ];
    expect(selectPackToRefund(packs)?.id).toBe(3);
    expect(planPackRefund(packs)).toEqual({ kind: "refunded", packId: 3, usedSessions: 1 });
  });

  it("reports no-pack rather than inventing one", () => {
    expect(planPackConsume([])).toEqual({ kind: "no-pack" });
    expect(planPackRefund([])).toEqual({ kind: "no-pack" });
  });

  it("refuses to push a pack past its own total", () => {
    // The invariant that until now lived only in clientSessionPacks.ts and so
    // was never applied on the booking path: increment() could overdraw.
    const full = [pack(9, 3, 3, "2026-01-01T00:00:00Z")];
    expect(planPackConsume(full)).toEqual({ kind: "exhausted" });
    const overdrawn = [pack(9, 3, 3, "2026-01-01T00:00:00Z"), pack(10, 3, 2, "2026-02-01T00:00:00Z")];
    expect(planPackConsume(overdrawn)).toEqual({ kind: "consumed", packId: 10, usedSessions: 3 });
  });

  it("separates an exhausted pack from having no pack at all", () => {
    // Both used to answer "no-pack", which made the `exhausted` variant
    // unreachable - so a client whose prepaid block had run out was
    // indistinguishable from one who pays per session, and the trainer got no
    // warning either way.
    expect(planPackConsume([pack(1, 4, 4, "2026-01-01T00:00:00Z")])).toEqual({
      kind: "exhausted",
    });
    expect(planPackRefund([pack(1, 4, 0, "2026-01-01T00:00:00Z")])).toEqual({
      kind: "exhausted",
    });
  });

});
