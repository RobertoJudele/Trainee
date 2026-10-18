// Interfaces the scheduling domain talks to. No sequelize type appears in
// this file - adapters/ holds every implementation, and container.ts is the
// only place they are wired together.
import {
  DateKey,
  Interval,
  PackView,
  PlannedSlot,
  SlotView,
  WorkingHourView,
} from "./types";

export interface Clock {
  now(): Date;
}

/** Hides the assign-code secret and the hashing/comparison of 6-digit codes. */
export interface AssignCodeCodec {
  generate(): { code: string; codeHash: string };
  hash(code: string): string;
}

export interface ClientRecord {
  readonly id: number;
  readonly role: string;
  readonly isActive: boolean;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
}

export interface TrainerRef {
  readonly id: number;
  readonly userId: number;
}

export interface AssignCodeRecord {
  readonly id: number;
  readonly clientId: number;
  readonly expiresAt: Date;
}

export interface BlockedDayView {
  readonly id: number;
  readonly trainerId: number;
  readonly date: DateKey;
  readonly reason: string | null;
}

// ── Read side ───────────────────────────────────────────────────────
//
// Tenancy is captured when the scope is built, not passed per call. No read
// method takes a trainerId, and none omits one - so a query cannot be
// written that forgets to scope itself. This is the shape that would have
// made the getPendingClientCodes cross-tenant leak (a `where` with no
// trainer predicate at all) impossible to express.

export interface TrainerScope {
  readonly trainerId: number;
  listSlotsInRange(range: Interval, opts?: { withClient?: boolean }): Promise<SlotView[]>;
  findOverlappingSlot(candidate: Interval, excludeSlotId?: number): Promise<SlotView | null>;
  findClientBookingOnDay(
    clientId: number,
    day: Interval,
    excludeSlotId: number
  ): Promise<SlotView | null>;
  listWorkingHours(opts?: { activeOnly?: boolean }): Promise<WorkingHourView[]>;
  findWorkingHourForWeekday(dayOfWeek: number, opts?: { activeOnly?: boolean }): Promise<WorkingHourView | null>;
  /** Omitting the range lists every blocked day, matching the existing
   *  endpoint - the month calendar asks for a window, the settings screen
   *  asks for all of them. */
  listBlockedDays(range?: { fromKey: DateKey; toKey: DateKey }): Promise<BlockedDayView[]>;
  isDayBlocked(dateKey: DateKey): Promise<boolean>;
  listPacksForClient(clientId: number): Promise<PackView[]>;
  listRosterClientIds(): Promise<number[]>;
  /** Live assign codes belonging to clients already on this trainer's roster. */
  listLiveRosterAssignCodes(now: Date, limit: number): Promise<Array<AssignCodeRecord & { client: ClientRecord }>>;
}

export interface ClientScope {
  readonly clientId: number;
  findAssignedSlot(slotId: number): Promise<SlotView | null>;
  listBookingsInRange(range: Interval): Promise<SlotView[]>;
}

export interface ScheduleReads {
  forTrainer(trainerId: number): TrainerScope;
  forClient(clientId: number): ClientScope;
}

// ── Unscoped lookups ────────────────────────────────────────────────
//
// Resolving "who is the trainer behind this user" is what creates a scope, so
// it cannot itself be scoped.

export interface ParticipantRepository {
  findTrainerByUserId(userId: number): Promise<TrainerRef | null>;
  findActiveClientById(userId: number): Promise<ClientRecord | null>;
  searchClients(query: string, limit: number): Promise<ClientRecord[]>;
}

/** Redeeming a typed 6-digit code is a bearer operation - knowing the digits
 *  is the authorisation, so this lookup is deliberately not trainer-scoped. */
export interface AssignCodeReader {
  findLiveByHash(codeHash: string, now: Date): Promise<AssignCodeRecord | null>;
}

// ── Write side ──────────────────────────────────────────────────────

export interface SlotWriter {
  /** Re-reads the slot under a row lock. Closes the check-then-act window
   *  between "is this slot free" and "assign it". */
  lockSlot(slotId: number): Promise<SlotView | null>;
  assign(slotId: number, to: { clientId: number; note: string | null }): Promise<SlotView>;
  release(slotId: number): Promise<SlotView>;
  createMany(rows: readonly PlannedSlot[]): Promise<SlotView[]>;
  createOne(row: PlannedSlot & { note: string | null }): Promise<SlotView>;
  deleteById(slotId: number): Promise<void>;
  /** The service decides *which* slots to drop (it already holds the list and
   *  the calendar rules); the repository just removes them. */
  deleteByIds(slotIds: readonly number[]): Promise<number>;
}

export interface PackWriter {
  setUsedSessions(packId: number, usedSessions: number): Promise<void>;
}

export interface RosterWriter {
  /** INSERT ... ON CONFLICT DO NOTHING - idempotent, so putting it inside the
   *  booking transaction cannot turn a benign duplicate into a failed
   *  booking. */
  ensureMember(clientId: number): Promise<void>;
}

export interface AssignCodeWriter {
  supersedeLiveForClient(clientId: number, at: Date): Promise<number>;
  issue(clientId: number, codeHash: string, expiresAt: Date): Promise<AssignCodeRecord>;
}

export interface WorkingHourWriter {
  upsert(input: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMin?: number;
    isActive?: boolean;
  }): Promise<{ row: WorkingHourView; created: boolean }>;
}

export interface BlockedDayWriter {
  block(dateKey: DateKey, reason: string | null): Promise<BlockedDayView>;
  unblock(dateKey: DateKey): Promise<void>;
}

/**
 * Everything a write needs, already bound to one trainer AND one open
 * transaction. Handed out by UnitOfWork.run - there is no way to obtain one
 * without opening a transaction, which is what makes "the lock only means
 * something inside a transaction" a type-level guarantee rather than a
 * convention.
 */
export interface WriteScope {
  readonly trainerId: number;
  readonly slots: SlotWriter;
  readonly packs: PackWriter;
  readonly roster: RosterWriter;
  readonly codes: AssignCodeWriter;
  readonly workingHours: WorkingHourWriter;
  readonly blockedDays: BlockedDayWriter;
  /** Reads inside the same transaction, so a decision and the write acting on
   *  it see the same snapshot. */
  readonly read: TrainerScope;

  /**
   * Runs `work` in a nested savepoint. On failure it rolls back only that
   * savepoint and reports it, leaving the enclosing transaction usable.
   *
   * This is how "pack bookkeeping must never fail the booking itself"
   * survives making the booking atomic. Previously that promise was bought
   * by doing the pack write outside any transaction and swallowing the error
   * in a catch; now the successful case commits with the booking and the
   * failing case is reported instead of vanishing into a console.error.
   */
  attempt<T>(
    label: string,
    work: () => Promise<T>
  ): Promise<{ ok: true; value: T } | { ok: false; error: unknown }>;
}

export interface ScheduleUnitOfWork {
  runForTrainer<T>(trainerId: number, work: (scope: WriteScope) => Promise<T>): Promise<T>;
  runForClient<T>(clientId: number, work: (scope: ClientWriteScope) => Promise<T>): Promise<T>;
}

/**
 * A client's own writes. Only the assign-code handshake lives here: a client
 * releasing their own booking still has to touch the owning trainer's pack
 * rows, so ScheduleService resolves the slot's trainer first and does that
 * work in a trainer scope instead of widening this one.
 */
export interface ClientWriteScope {
  readonly clientId: number;
  readonly codes: AssignCodeWriter;
}
