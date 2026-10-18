// Pure scheduling rules. No sequelize, no express, no `new Date()` read from
// inside a function - every time-dependent function takes the instant it
// needs as an argument. Everything here is directly unit-testable without a
// database or an HTTP round trip, which is the point: before this module the
// slot arithmetic lived inside three Express handlers and could only be
// exercised by driving the real API against real Postgres.
import {
  addDaysToKey,
  dateKeyWeekday,
  dayDiff,
  parseTimeToMinutes,
  zonedWallClockToUtc,
} from "../../utils/scheduleTime";
import {
  DateKey,
  Interval,
  PackMovement,
  PackView,
  PlannedSlot,
  Shift,
  SkippedSlot,
  SlotPhase,
  SlotPlan,
  SlotView,
  WorkingHourView,
} from "./types";

/** Longest span a single generate request may cover. */
export const MAX_GENERATE_RANGE_DAYS = 62;

// ── The slot-free rule ──────────────────────────────────────────────
//
// THE overlap rule, and the only one. Half-open [start, end): two slots that
// merely touch (one ends exactly when the next begins) do not overlap.
//
// This replaces three divergent implementations that disagreed with each
// other. generateSlots used a range test like this one; regenerateDay
// compared *exact start instants* instead, so regenerating a day at a
// different slot duration would happily create a free 09:30-10:00 slot on
// top of an already-booked 09:00-10:00 one - the booked slot's start instant
// didn't match, so the check passed. createOneOffSlot expressed the correct
// rule a third time, in SQL.
export const overlaps = (a: Interval, b: Interval): boolean =>
  a.start < b.end && a.end > b.start;

const overlapsAny = (candidate: Interval, occupied: readonly Interval[]): boolean =>
  occupied.some((taken) => overlaps(candidate, taken));

// ── Slot phase ──────────────────────────────────────────────────────
//
// `status` on the row is a denormalisation of "does this slot have a client".
// The domain reasons about the fact, not the column.
export const phaseOf = (slot: Pick<SlotView, "clientId">): SlotPhase =>
  slot.clientId == null ? "free" : "booked";

export const isFree = (slot: Pick<SlotView, "clientId">): boolean => phaseOf(slot) === "free";

/**
 * What generate/regenerate/block must never destroy. Derived from the demand
 * side rather than declared as a status list - the old
 * PROTECTED_SLOT_STATUSES array named three statuses that no code could
 * produce, and a canceled slot in that list would have sterilised its own
 * time window forever.
 */
export const isProtected = (slot: Pick<SlotView, "clientId">): boolean =>
  phaseOf(slot) === "booked";

// ── Shift resolution ────────────────────────────────────────────────

export interface ShiftValidation {
  readonly ok: boolean;
  readonly error?: string;
}

export const validateShift = (shift: Shift): ShiftValidation => {
  if (shift.endMin <= shift.startMin) {
    return { ok: false, error: "endTime must be after startTime" };
  }
  if (shift.durationMin <= 0) {
    return { ok: false, error: "slotDurationMin must be positive" };
  }
  return { ok: true };
};

export const shiftFromTemplate = (
  template: WorkingHourView,
  durationOverrideMin?: number
): Shift => ({
  startMin: parseTimeToMinutes(template.startTime),
  endMin: parseTimeToMinutes(template.endTime),
  durationMin:
    durationOverrideMin && durationOverrideMin > 0
      ? durationOverrideMin
      : template.slotDurationMin,
  workingHourId: template.id,
});

export const shiftFromExplicitHours = (
  startTime: string,
  endTime: string,
  durationMin: number
): Shift => ({
  startMin: parseTimeToMinutes(startTime),
  endMin: parseTimeToMinutes(endTime),
  durationMin,
  workingHourId: null,
});

export const validateGenerateRange = (
  fromKey: DateKey,
  toKey: DateKey,
  maxDays: number = MAX_GENERATE_RANGE_DAYS
): ShiftValidation => {
  const span = dayDiff(fromKey, toKey);
  if (span < 0) {
    return { ok: false, error: "Invalid date range" };
  }
  if (span > maxDays) {
    return { ok: false, error: `Date range too large (max ${maxDays} days)` };
  }
  return { ok: true };
};

// ── The generator ───────────────────────────────────────────────────

export interface PlanInput {
  readonly fromKey: DateKey;
  readonly toKey: DateKey;
  readonly timeZone: string;
  /**
   * Shifts to slice. Either keyed by weekday (the working-hours template
   * case, where each day in the range picks the shifts matching its weekday)
   * or a single explicit list applied to every day in the range (the
   * regenerate-with-override and one-off cases, which are always one day).
   */
  readonly shiftsByWeekday?: ReadonlyMap<number, readonly Shift[]>;
  readonly shifts?: readonly Shift[];
  readonly blockedKeys: ReadonlySet<DateKey>;
  /** Booked slots the plan must generate around, never over. */
  readonly occupied: readonly Interval[];
}

/**
 * THE slot generator. generateSlots, regenerateDay and createOneOffSlot all
 * reduce to this - the three of them previously carried three copies of this
 * loop, with three different answers to "is this time already taken".
 *
 * Reports what it skipped and why rather than silently dropping it, so a
 * caller that must treat a collision as an error (createOneOffSlot answers
 * 409) can, while the bulk generators keep skipping.
 */
export const planSlots = (input: PlanInput): SlotPlan => {
  const create: PlannedSlot[] = [];
  const skipped: SkippedSlot[] = [];

  // Grows as the plan proceeds: a slot this run just planned also occupies
  // its window, so two shifts on the same day cannot overlap each other.
  const taken: Interval[] = input.occupied.map((i) => ({ start: i.start, end: i.end }));

  for (
    let dayKey = input.fromKey;
    dayDiff(dayKey, input.toKey) >= 0;
    dayKey = addDaysToKey(dayKey, 1)
  ) {
    const dayShifts =
      input.shifts ?? input.shiftsByWeekday?.get(dateKeyWeekday(dayKey)) ?? [];

    if (input.blockedKeys.has(dayKey)) {
      for (const shift of dayShifts) {
        skipped.push({
          startsAt: zonedWallClockToUtc(dayKey, shift.startMin, input.timeZone),
          endsAt: zonedWallClockToUtc(dayKey, shift.endMin, input.timeZone),
          reason: "blocked",
        });
      }
      continue;
    }

    for (const shift of dayShifts) {
      for (
        let minute = shift.startMin;
        minute + shift.durationMin <= shift.endMin;
        minute += shift.durationMin
      ) {
        const startsAt = zonedWallClockToUtc(dayKey, minute, input.timeZone);
        const endsAt = zonedWallClockToUtc(
          dayKey,
          minute + shift.durationMin,
          input.timeZone
        );

        if (overlapsAny({ start: startsAt, end: endsAt }, taken)) {
          skipped.push({ startsAt, endsAt, reason: "occupied" });
          continue;
        }

        taken.push({ start: startsAt, end: endsAt });
        create.push({ startsAt, endsAt, workingHourId: shift.workingHourId });
      }
    }
  }

  return { create, skipped };
};

// ── Session packs ───────────────────────────────────────────────────
//
// Booking consumes a session from the client's oldest pack that still has
// room; cancelling refunds it to the newest pack that has a used session -
// the one the last consume most likely landed in. The asymmetry is
// deliberate and pre-existing; it is expressed here once so it can be
// asserted in a test rather than inferred from two `order:` clauses 15 lines
// apart.

export const selectPackToConsume = (packs: readonly PackView[]): PackView | null => {
  const open = packs
    .filter((p) => p.usedSessions < p.totalSessions)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return open[0] ?? null;
};

export const selectPackToRefund = (packs: readonly PackView[]): PackView | null => {
  const used = packs
    .filter((p) => p.usedSessions > 0)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return used[0] ?? null;
};

/**
 * Enforces `usedSessions <= totalSessions`, an invariant that until now lived
 * only in a different controller (clientSessionPacks.ts) and so was never
 * applied on the booking path at all - `increment("usedSessions")` could push
 * a pack past its own total.
 *
 * The selector's `usedSessions < totalSessions` filter *is* that enforcement:
 * a pack it returns has room by construction, so there is no second bounds
 * check here to disagree with it.
 */
export const planPackConsume = (packs: readonly PackView[]): PackMovement => {
  const target = selectPackToConsume(packs);
  if (target) {
    return { kind: "consumed", packId: target.id, usedSessions: target.usedSessions + 1 };
  }
  // Telling "has packs, all used up" apart from "has no packs at all" is what
  // lets the trainer be warned that their client's prepaid block ran out,
  // rather than both cases looking like "this client does not use packs".
  return packs.length > 0 ? { kind: "exhausted" } : { kind: "no-pack" };
};

export const planPackRefund = (packs: readonly PackView[]): PackMovement => {
  const target = selectPackToRefund(packs);
  if (target) {
    return { kind: "refunded", packId: target.id, usedSessions: target.usedSessions - 1 };
  }
  return packs.length > 0 ? { kind: "exhausted" } : { kind: "no-pack" };
};
