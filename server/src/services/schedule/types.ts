// Plain value shapes for the scheduling domain. Nothing here imports
// sequelize, express or a model - these are the types the pure functions in
// domain.ts operate on, and the types adapters map rows into.

/** "YYYY-MM-DD" in a trainer's local calendar. */
export type DateKey = string;

/** Minutes from local midnight, e.g. 9 * 60 for 09:00. */
export type MinutesFromMidnight = number;

/** A half-open absolute-time interval: [start, end). */
export interface Interval {
  readonly start: Date;
  readonly end: Date;
}

/**
 * A slot is either open or booked. Attendance confirmation was never
 * finished and has been removed rather than completed - see the SlotStatus
 * comment in types/schedule.ts.
 */
export type SlotPhase = "free" | "booked";

/**
 * The public identity of a participant, as it appears on the wire. The trainer
 * day planner renders the booked client's name, so this travels with the slot.
 */
export interface SlotParticipant {
  readonly id: number;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
}

/** The domain's view of a slot row. */
export interface SlotView {
  readonly id: number;
  readonly trainerId: number;
  readonly clientId: number | null;
  readonly workingHourId: number | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly note: string | null;
  /** Present only when the read asked for it; never used by domain rules. */
  readonly client?: SlotParticipant | null;
}

/** One contiguous stretch of a trainer's working day, before it is sliced. */
export interface Shift {
  readonly startMin: MinutesFromMidnight;
  readonly endMin: MinutesFromMidnight;
  readonly durationMin: number;
  readonly workingHourId: number | null;
}

/** A working-hours template row, as the domain sees it. */
export interface WorkingHourView {
  readonly id: number;
  readonly trainerId: number;
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly slotDurationMin: number;
  readonly isActive: boolean;
}

/** A slot the planner decided to create. */
export interface PlannedSlot {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly workingHourId: number | null;
}

export type SkipReason = "blocked" | "occupied" | "no-template";

export interface SkippedSlot {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly reason: SkipReason;
}

export interface SlotPlan {
  readonly create: readonly PlannedSlot[];
  readonly skipped: readonly SkippedSlot[];
}

/** A client's prepaid block of sessions. */
export interface PackView {
  readonly id: number;
  readonly totalSessions: number;
  readonly usedSessions: number;
  readonly createdAt: Date;
}

export type PackMovement =
  /** A pack row was written. */
  | { readonly kind: "consumed"; readonly packId: number; readonly usedSessions: number }
  | { readonly kind: "refunded"; readonly packId: number; readonly usedSessions: number }
  /** The client has packs with this trainer, but none could absorb the move:
   *  every one is fully used (consume) or fully unused (refund). */
  | { readonly kind: "exhausted" }
  /** The client has no packs with this trainer; they pay some other way. */
  | { readonly kind: "no-pack" };

/** Why a booking was refused. Maps to an HTTP status at the edge. */
export type BookingRefusal =
  | "slot-not-found"
  | "slot-not-free"
  | "client-not-found"
  | "duplicate-on-day";
