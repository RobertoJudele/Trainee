import {
  addDaysToKey,
  dateKeyWeekday,
  extractDateKey,
  isDateKey,
  isValidTimeZone,
  parseTimeToMinutes,
  utcInstantToDateKey,
  zonedWallClockToUtc,
} from "../../utils/scheduleTime";
import * as domain from "./domain";
import {
  AssignCodeCodec,
  AssignCodeReader,
  AssignCodeRecord,
  BlockedDayView,
  ClientRecord,
  Clock,
  ParticipantRepository,
  ScheduleReads,
  ScheduleUnitOfWork,
  TrainerRef,
  WriteScope,
} from "./ports";
import { DateKey, Interval, PackMovement, Shift, SlotView, WorkingHourView } from "./types";

/**
 * One error type for the whole module, carrying the status the edge answers
 * with. It replaces ~40 inline sendError calls that disagreed with each other
 * about the same condition: a missing trainer profile was 403 in generateSlots
 * and 404 in requireTrainer, and "slot is not available" answered 400 on
 * assign but 409 on delete.
 */
export class ScheduleError extends Error {
  constructor(
    readonly code: ScheduleErrorCode,
    readonly status: number,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ScheduleError";
  }
}

export type ScheduleErrorCode =
  | "NOT_TRAINER"
  | "NOT_CLIENT"
  | "TRAINER_NOT_FOUND"
  | "SLOT_NOT_FOUND"
  | "SLOT_NOT_FREE"
  | "SLOT_NOT_EMPTY"
  | "SLOT_OVERLAP"
  | "CLIENT_NOT_FOUND"
  | "CLIENT_DOUBLE_BOOKED"
  | "CODE_INVALID"
  | "DAY_BLOCKED"
  | "DAY_HAS_BOOKINGS"
  | "NO_TEMPLATE"
  | "INVALID_INPUT";

/** The caller, as the edge knows them. The service never touches `req`. */
export interface Actor {
  readonly userId: number;
  readonly role: string;
}

/** Raw query/body values, still untrusted - the service does the parsing. */
export interface RangeQuery {
  readonly from?: unknown;
  readonly to?: unknown;
  readonly timeZone?: unknown;
}

export interface ResolvedRange extends Interval {
  readonly fromKey: DateKey;
  readonly toKey: DateKey;
  readonly timeZone: string;
}

export interface GenerateResult {
  readonly created: readonly SlotView[];
  readonly removed: number;
  readonly preserved: number;
}

export interface BookingResult {
  readonly slot: SlotView;
  readonly client: ClientRecord;
  readonly pack: PackMovement;
  readonly warnings: readonly string[];
}

export interface ReleaseResult {
  readonly slot: SlotView;
  readonly alreadyFree: boolean;
  readonly pack: PackMovement;
  readonly warnings: readonly string[];
}

export interface ResolvedAssignCode {
  readonly assignCodeId: number;
  readonly expiresAt: Date;
  readonly client: ClientRecord;
}

export interface ScheduleServiceConfig {
  /**
   * Fallback zone when the caller sends none. Resolved in container.ts from
   * env; this module reads no process.env at all, so importing it can never
   * throw on a missing variable the way the old controller's module-scope
   * getRequiredEnv call could.
   */
  readonly defaultTimeZone: string;
  readonly trainerRangeDays?: number;
  readonly clientRangeDays?: number;
  readonly assignCodeTtlMinutes?: number;
  readonly pendingCodeLimit?: number;
  readonly clientSearchLimit?: number;
  readonly minSearchQueryLength?: number;
}

export interface ScheduleServiceDeps extends ScheduleServiceConfig {
  readonly reads: ScheduleReads;
  readonly uow: ScheduleUnitOfWork;
  readonly participants: ParticipantRepository;
  readonly assignCodes: AssignCodeReader;
  readonly codec: AssignCodeCodec;
  readonly clock: Clock;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class ScheduleService {
  private readonly trainerRangeDays: number;
  private readonly clientRangeDays: number;
  private readonly assignCodeTtlMinutes: number;
  private readonly pendingCodeLimit: number;
  private readonly clientSearchLimit: number;
  private readonly minSearchQueryLength: number;

  constructor(private readonly deps: ScheduleServiceDeps) {
    this.trainerRangeDays = deps.trainerRangeDays ?? 14;
    this.clientRangeDays = deps.clientRangeDays ?? 30;
    this.assignCodeTtlMinutes = deps.assignCodeTtlMinutes ?? 10;
    this.pendingCodeLimit = deps.pendingCodeLimit ?? 100;
    this.clientSearchLimit = deps.clientSearchLimit ?? 15;
    this.minSearchQueryLength = deps.minSearchQueryLength ?? 2;
  }

  // ── Actor resolution ──────────────────────────────────────────────
  //
  // The "role check, then look up the trainer, then 404" preamble that was
  // retyped at the top of eight handlers, and whose late-arriving helper
  // (requireTrainer, declared 837 lines in) only ever served the six handlers
  // written below it.

  private async requireTrainer(actor: Actor): Promise<TrainerRef> {
    if (actor.role !== "trainer") {
      throw new ScheduleError("NOT_TRAINER", 403, "Trainer access required");
    }
    const trainer = await this.deps.participants.findTrainerByUserId(actor.userId);
    if (!trainer) {
      throw new ScheduleError("TRAINER_NOT_FOUND", 404, "Trainer profile not found");
    }
    return trainer;
  }

  // ── Time resolution ───────────────────────────────────────────────
  //
  // The single producer of a {start, end} window. It replaces toDayBounds and
  // parseDateQuery, which both used server-local Date#setHours - in direct
  // violation of the contract stated at the top of utils/scheduleTime.ts -
  // plus a third ad-hoc style in getClientSchedule. On a UTC server the
  // results are identical; on a non-UTC one the old read paths disagreed with
  // the write paths about which calendar day a slot belonged to.

  private resolveTimeZone(input?: unknown): string {
    const raw = typeof input === "string" ? input.trim() : "";
    const candidate = raw || this.deps.defaultTimeZone;
    return isValidTimeZone(candidate) ? candidate : "UTC";
  }

  /** A half-open window [start, end) covering whole local days fromKey..toKey. */
  private windowFor(fromKey: DateKey, toKey: DateKey, timeZone: string): Interval {
    return {
      start: zonedWallClockToUtc(fromKey, 0, timeZone),
      // The exclusive end is midnight of the day *after* toKey, matching
      // domain.overlaps. The old queries used Op.between with an inclusive
      // end, so a slot starting exactly at midnight fell in two adjacent days.
      end: zonedWallClockToUtc(addDaysToKey(toKey, 1), 0, timeZone),
    };
  }

  private resolveRange(query: RangeQuery | undefined, defaultDays: number): ResolvedRange {
    const timeZone = this.resolveTimeZone(query?.timeZone);
    const todayKey = utcInstantToDateKey(this.deps.clock.now(), timeZone);

    const fromKey = query?.from ? extractDateKey(String(query.from), timeZone) : todayKey;
    if (!fromKey) {
      throw new ScheduleError("INVALID_INPUT", 400, "from must be a date");
    }
    const toKey = query?.to
      ? extractDateKey(String(query.to), timeZone)
      : addDaysToKey(fromKey, defaultDays);
    if (!toKey) {
      throw new ScheduleError("INVALID_INPUT", 400, "to must be a date");
    }

    return { fromKey, toKey, timeZone, ...this.windowFor(fromKey, toKey, timeZone) };
  }

  private requireDateKey(value: unknown): DateKey {
    const key = String(value);
    if (!isDateKey(key)) {
      throw new ScheduleError("INVALID_INPUT", 400, "date must be YYYY-MM-DD");
    }
    return key;
  }

  private requireSlotId(value: unknown): number {
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) {
      throw new ScheduleError("INVALID_INPUT", 400, "Invalid slot id");
    }
    return id;
  }

  private checkShift(shift: Shift): Shift {
    const result = domain.validateShift(shift);
    if (!result.ok) {
      throw new ScheduleError("INVALID_INPUT", 400, result.error as string);
    }
    return shift;
  }

  // ── Working hours ─────────────────────────────────────────────────

  async saveWorkingHour(
    actor: Actor,
    input: {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      slotDurationMin?: number;
      isActive?: boolean;
    }
  ): Promise<{ row: WorkingHourView; created: boolean }> {
    const trainer = await this.requireTrainer(actor);

    if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      throw new ScheduleError(
        "INVALID_INPUT",
        400,
        "dayOfWeek must be an integer between 0 and 6"
      );
    }
    if (!HHMM.test(input.startTime) || !HHMM.test(input.endTime)) {
      throw new ScheduleError("INVALID_INPUT", 400, "startTime and endTime must be HH:mm");
    }
    this.checkShift(
      domain.shiftFromExplicitHours(input.startTime, input.endTime, input.slotDurationMin ?? 60)
    );

    return this.deps.uow.runForTrainer(trainer.id, (scope) => scope.workingHours.upsert(input));
  }

  async listWorkingHours(actor: Actor): Promise<WorkingHourView[]> {
    const trainer = await this.requireTrainer(actor);
    return this.deps.reads.forTrainer(trainer.id).listWorkingHours();
  }

  // ── Supply: one generator behind three call shapes ────────────────

  /**
   * generate, regenerateDay and addSlot all reduce to domain.planSlots. They
   * used to carry three copies of the slot-walking loop with three different
   * answers to "is this time already taken" - see the comment on
   * domain.overlaps for the bug that produced.
   */
  async generate(
    actor: Actor,
    input: { fromDate: unknown; toDate: unknown; timeZone?: unknown }
  ): Promise<GenerateResult> {
    const trainer = await this.requireTrainer(actor);
    const timeZone = this.resolveTimeZone(input.timeZone);
    const fromKey = extractDateKey(String(input.fromDate), timeZone);
    const toKey = extractDateKey(String(input.toDate), timeZone);
    if (!fromKey || !toKey) {
      throw new ScheduleError("INVALID_INPUT", 400, "Invalid date range");
    }
    const range = domain.validateGenerateRange(fromKey, toKey);
    if (!range.ok) {
      throw new ScheduleError("INVALID_INPUT", 400, range.error as string);
    }

    const read = this.deps.reads.forTrainer(trainer.id);
    const templates = await read.listWorkingHours({ activeOnly: true });
    if (templates.length === 0) {
      throw new ScheduleError("NO_TEMPLATE", 400, "No active working-hour templates found");
    }

    const shiftsByWeekday = new Map<number, Shift[]>();
    for (const template of templates) {
      const shifts = shiftsByWeekday.get(template.dayOfWeek) ?? [];
      shifts.push(domain.shiftFromTemplate(template));
      shiftsByWeekday.set(template.dayOfWeek, shifts);
    }

    const blockedKeys = new Set(
      (await read.listBlockedDays({ fromKey, toKey })).map((day) => day.date)
    );
    const window = this.windowFor(fromKey, toKey, timeZone);

    return this.deps.uow.runForTrainer(trainer.id, async (scope) => {
      const existing = await scope.read.listSlotsInRange(window);
      const booked = existing.filter(domain.isProtected);

      // Free slots are replaced only on days the templates actually cover and
      // that are not blocked, so a changed slot duration regenerates that day
      // instead of leaving stale overlapping slots behind.
      const stale = existing.filter((slot) => {
        if (!domain.isFree(slot)) return false;
        const key = utcInstantToDateKey(slot.startsAt, timeZone);
        return !blockedKeys.has(key) && shiftsByWeekday.has(dateKeyWeekday(key));
      });

      const removed = await scope.slots.deleteByIds(stale.map((slot) => slot.id));

      const plan = domain.planSlots({
        fromKey,
        toKey,
        timeZone,
        shiftsByWeekday,
        blockedKeys,
        occupied: booked.map((slot) => ({ start: slot.startsAt, end: slot.endsAt })),
      });

      return {
        created: await scope.slots.createMany(plan.create),
        removed,
        preserved: booked.length,
      };
    });
  }

  async regenerateDay(
    actor: Actor,
    date: unknown,
    input: {
      startTime?: string;
      endTime?: string;
      slotDurationMin?: number;
      timeZone?: unknown;
    }
  ): Promise<GenerateResult> {
    const trainer = await this.requireTrainer(actor);
    const dateKey = this.requireDateKey(date);
    const timeZone = this.resolveTimeZone(input.timeZone);
    const read = this.deps.reads.forTrainer(trainer.id);

    if (await read.isDayBlocked(dateKey)) {
      throw new ScheduleError("DAY_BLOCKED", 409, "Day is blocked; unblock before regenerating");
    }

    let shift: Shift;
    if (input.startTime && input.endTime) {
      shift = domain.shiftFromExplicitHours(
        input.startTime,
        input.endTime,
        input.slotDurationMin && input.slotDurationMin > 0 ? input.slotDurationMin : 60
      );
    } else {
      const template = await read.findWorkingHourForWeekday(dateKeyWeekday(dateKey), {
        activeOnly: true,
      });
      if (!template) {
        throw new ScheduleError(
          "NO_TEMPLATE",
          400,
          "No active template for this weekday; provide custom hours"
        );
      }
      shift = domain.shiftFromTemplate(template, input.slotDurationMin);
    }
    this.checkShift(shift);

    const window = this.windowFor(dateKey, dateKey, timeZone);

    return this.deps.uow.runForTrainer(trainer.id, async (scope) => {
      const existing = await scope.read.listSlotsInRange(window);
      const booked = existing.filter(domain.isProtected);

      const removed = await scope.slots.deleteByIds(
        existing.filter(domain.isFree).map((slot) => slot.id)
      );

      const plan = domain.planSlots({
        fromKey: dateKey,
        toKey: dateKey,
        timeZone,
        shifts: [shift],
        blockedKeys: new Set<DateKey>(),
        // The old regenerateDay compared exact start *instants* here, so
        // regenerating at a different duration would plant a free 09:30-10:00
        // slot on top of an already-booked 09:00-10:00 one.
        occupied: booked.map((slot) => ({ start: slot.startsAt, end: slot.endsAt })),
      });

      return {
        created: await scope.slots.createMany(plan.create),
        removed,
        preserved: booked.length,
      };
    });
  }

  async addSlot(
    actor: Actor,
    input: {
      date: unknown;
      startTime: string;
      endTime: string;
      note?: string;
      timeZone?: unknown;
    }
  ): Promise<SlotView> {
    const trainer = await this.requireTrainer(actor);
    const dateKey = this.requireDateKey(input.date);
    const timeZone = this.resolveTimeZone(input.timeZone);

    // One slot spanning the whole window: its duration *is* the window.
    const startMin = parseTimeToMinutes(input.startTime);
    const endMin = parseTimeToMinutes(input.endTime);
    const shift = this.checkShift({
      startMin,
      endMin,
      durationMin: endMin - startMin,
      workingHourId: null,
    });

    if (await this.deps.reads.forTrainer(trainer.id).isDayBlocked(dateKey)) {
      throw new ScheduleError("DAY_BLOCKED", 409, "Day is blocked; unblock before adding slots");
    }

    const planned = domain.planSlots({
      fromKey: dateKey,
      toKey: dateKey,
      timeZone,
      shifts: [shift],
      blockedKeys: new Set<DateKey>(),
      occupied: [],
    }).create[0];
    if (!planned) {
      throw new ScheduleError("INVALID_INPUT", 400, "Could not place a slot in that window");
    }

    return this.deps.uow.runForTrainer(trainer.id, async (scope) => {
      // Unlike the bulk generators, a one-off slot that collides is an error
      // rather than a skip: the trainer asked for this exact time.
      const clash = await scope.read.findOverlappingSlot({
        start: planned.startsAt,
        end: planned.endsAt,
      });
      if (clash) {
        throw new ScheduleError("SLOT_OVERLAP", 409, "Overlaps an existing slot");
      }
      return scope.slots.createOne({ ...planned, note: input.note ?? null });
    });
  }

  async deleteSlot(actor: Actor, slotId: unknown): Promise<number> {
    const trainer = await this.requireTrainer(actor);
    const id = this.requireSlotId(slotId);

    return this.deps.uow.runForTrainer(trainer.id, async (scope) => {
      const slot = await scope.slots.lockSlot(id);
      if (!slot) {
        throw new ScheduleError("SLOT_NOT_FOUND", 404, "Slot not found");
      }
      if (domain.isProtected(slot)) {
        throw new ScheduleError(
          "SLOT_NOT_EMPTY",
          409,
          "Cannot delete a slot with an assignment; unassign first"
        );
      }
      await scope.slots.deleteById(id);
      return id;
    });
  }

  // ── Demand: booking and release ───────────────────────────────────

  /**
   * Atomic across slot, roster and pack. This was three independent commits
   * with no transaction between them: a crash after the slot update left a
   * booked slot with no roster row - silently denying the client's right to
   * review - or an unconsumed pack session, and the API still answered 200.
   */
  async book(
    actor: Actor,
    slotId: unknown,
    input: { clientId: unknown; note?: string }
  ): Promise<BookingResult> {
    const trainer = await this.requireTrainer(actor);
    const id = this.requireSlotId(slotId);

    const clientId = Number(input.clientId);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      throw new ScheduleError("INVALID_INPUT", 400, "Invalid client id");
    }

    const client = await this.deps.participants.findActiveClientById(clientId);
    if (!client) {
      throw new ScheduleError("CLIENT_NOT_FOUND", 404, "Client not found");
    }

    const timeZone = this.resolveTimeZone();

    return this.deps.uow.runForTrainer(trainer.id, async (scope) => {
      // A locked read, so the "is it free" check and the write that acts on it
      // see the same row. The old code read the slot, checked its status and
      // then updated, with nothing in between to stop a second concurrent
      // request passing the very same check.
      const slot = await scope.slots.lockSlot(id);
      if (!slot) {
        throw new ScheduleError("SLOT_NOT_FOUND", 404, "Slot not found");
      }
      if (!domain.isFree(slot)) {
        throw new ScheduleError("SLOT_NOT_FREE", 400, "Slot is not available");
      }

      const dayKey = utcInstantToDateKey(slot.startsAt, timeZone);
      const duplicate = await scope.read.findClientBookingOnDay(
        client.id,
        this.windowFor(dayKey, dayKey, timeZone),
        slot.id
      );
      if (duplicate) {
        throw new ScheduleError(
          "CLIENT_DOUBLE_BOOKED",
          409,
          "This client is already assigned on the selected day"
        );
      }

      const assigned = await scope.slots.assign(slot.id, {
        clientId: client.id,
        note: input.note ?? null,
      });

      // Roster membership is what review.ts accepts as proof of a training
      // relationship, so it commits with the booking instead of being
      // best-effort inside a swallowing try/catch.
      await scope.roster.ensureMember(client.id);

      const warnings: string[] = [];
      const pack = await this.movePack(scope, client.id, "consume", warnings);

      return { slot: assigned, client, pack, warnings };
    });
  }

  /**
   * Either the trainer who owns the slot or the client booked into it may
   * release it. The client's path resolves the owning trainer first, because
   * pack rows are keyed on (trainerId, clientId) - the refund cannot be done
   * from an unscoped write.
   */
  async release(actor: Actor, slotId: unknown): Promise<ReleaseResult> {
    const id = this.requireSlotId(slotId);

    let trainerId: number;
    let restrictToClientId: number | null = null;

    if (actor.role === "trainer") {
      trainerId = (await this.requireTrainer(actor)).id;
    } else if (actor.role === "client") {
      const booking = await this.deps.reads.forClient(actor.userId).findAssignedSlot(id);
      if (!booking) {
        throw new ScheduleError("SLOT_NOT_FOUND", 404, "Slot not found");
      }
      trainerId = booking.trainerId;
      restrictToClientId = actor.userId;
    } else {
      throw new ScheduleError("NOT_TRAINER", 403, "Access denied");
    }

    return this.deps.uow.runForTrainer(trainerId, async (scope) => {
      const slot = await scope.slots.lockSlot(id);
      // Re-checked under the lock: between the unlocked lookup above and here
      // the trainer could have released and re-assigned the slot to someone
      // else, and this client must not be able to cancel that booking.
      if (!slot || (restrictToClientId !== null && slot.clientId !== restrictToClientId)) {
        throw new ScheduleError("SLOT_NOT_FOUND", 404, "Slot not found");
      }
      if (domain.isFree(slot)) {
        return {
          slot,
          alreadyFree: true,
          pack: { kind: "no-pack" } as PackMovement,
          warnings: [],
        };
      }

      const previousClientId = slot.clientId as number;
      const released = await scope.slots.release(id);
      const warnings: string[] = [];
      const pack = await this.movePack(scope, previousClientId, "refund", warnings);

      return { slot: released, alreadyFree: false, pack, warnings };
    });
  }

  /**
   * Pack bookkeeping runs inside the booking transaction but in its own
   * savepoint, so the documented rule ("pack bookkeeping must never fail the
   * booking itself") survives making the booking atomic. A failure is reported
   * as a warning instead of disappearing into a console.error.
   */
  private async movePack(
    scope: WriteScope,
    clientId: number,
    direction: "consume" | "refund",
    warnings: string[]
  ): Promise<PackMovement> {
    const attempt = await scope.attempt(`pack-${direction}`, async () => {
      const packs = await scope.read.listPacksForClient(clientId);
      const movement =
        direction === "consume" ? domain.planPackConsume(packs) : domain.planPackRefund(packs);
      if (movement.kind === "consumed" || movement.kind === "refunded") {
        await scope.packs.setUsedSessions(movement.packId, movement.usedSessions);
      }
      return movement;
    });

    if (!attempt.ok) {
      warnings.push("PACK_BOOKKEEPING_FAILED");
      return { kind: "no-pack" };
    }
    if (attempt.value.kind === "exhausted") {
      warnings.push("PACK_EXHAUSTED");
    }
    return attempt.value;
  }

  // ── Reads ─────────────────────────────────────────────────────────

  async listTrainerSlots(actor: Actor, query?: RangeQuery): Promise<SlotView[]> {
    const trainer = await this.requireTrainer(actor);
    const range = this.resolveRange(query, this.trainerRangeDays);
    return this.deps.reads.forTrainer(trainer.id).listSlotsInRange(range, { withClient: true });
  }

  async listClientSchedule(actor: Actor, query?: RangeQuery): Promise<SlotView[]> {
    const range = this.resolveRange(query, this.clientRangeDays);
    return this.deps.reads.forClient(actor.userId).listBookingsInRange(range);
  }

  async listBlockedDays(actor: Actor, query?: RangeQuery): Promise<BlockedDayView[]> {
    const trainer = await this.requireTrainer(actor);
    const timeZone = this.resolveTimeZone(query?.timeZone);
    const fromKey = query?.from ? extractDateKey(String(query.from), timeZone) : null;
    const toKey = query?.to ? extractDateKey(String(query.to), timeZone) : null;
    // Both or neither: a half-given range lists everything, as before.
    const range = fromKey && toKey ? { fromKey, toKey } : undefined;
    return this.deps.reads.forTrainer(trainer.id).listBlockedDays(range);
  }

  async findClients(actor: Actor, rawQuery: unknown): Promise<ClientRecord[]> {
    await this.requireTrainer(actor);
    const query = String(rawQuery ?? "").trim();
    if (query.length < this.minSearchQueryLength) {
      throw new ScheduleError(
        "INVALID_INPUT",
        400,
        `Query must have at least ${this.minSearchQueryLength} characters`
      );
    }
    return this.deps.participants.searchClients(query, this.clientSearchLimit);
  }

  // ── Blocked days ──────────────────────────────────────────────────

  async blockDay(
    actor: Actor,
    input: { date: unknown; reason?: string; timeZone?: unknown }
  ): Promise<{ blockedDate: BlockedDayView; removedAvailable: number }> {
    const trainer = await this.requireTrainer(actor);
    const dateKey = this.requireDateKey(input.date);
    const timeZone = this.resolveTimeZone(input.timeZone);
    const window = this.windowFor(dateKey, dateKey, timeZone);

    return this.deps.uow.runForTrainer(trainer.id, async (scope) => {
      const existing = await scope.read.listSlotsInRange(window, { withClient: true });
      const booked = existing.filter(domain.isProtected);
      if (booked.length > 0) {
        throw new ScheduleError(
          "DAY_HAS_BOOKINGS",
          409,
          "Day has assigned sessions; unassign them before blocking",
          {
            conflicts: booked.map((slot) => ({
              slotId: slot.id,
              startsAt: slot.startsAt,
              client: slot.client
                ? {
                    id: slot.client.id,
                    firstName: slot.client.firstName,
                    lastName: slot.client.lastName,
                  }
                : null,
            })),
          }
        );
      }

      const removedAvailable = await scope.slots.deleteByIds(
        existing.filter(domain.isFree).map((slot) => slot.id)
      );
      const blockedDate = await scope.blockedDays.block(dateKey, input.reason ?? null);
      return { blockedDate, removedAvailable };
    });
  }

  async unblockDay(actor: Actor, date: unknown): Promise<DateKey> {
    const trainer = await this.requireTrainer(actor);
    const dateKey = this.requireDateKey(date);
    // Unblocking deliberately does NOT recreate slots; the trainer regenerates.
    await this.deps.uow.runForTrainer(trainer.id, (scope) => scope.blockedDays.unblock(dateKey));
    return dateKey;
  }

  // ── The client assign-code handshake ──────────────────────────────

  async issueAssignCode(actor: Actor): Promise<{ code: string; expiresAt: Date }> {
    if (actor.role !== "client") {
      throw new ScheduleError("NOT_CLIENT", 403, "Client access required");
    }
    const now = this.deps.clock.now();
    const expiresAt = new Date(now.getTime() + this.assignCodeTtlMinutes * 60 * 1000);
    const { code, codeHash } = this.deps.codec.generate();

    await this.deps.uow.runForClient(actor.userId, async (scope) => {
      // Supersede-then-issue is one transaction, so a client can never be left
      // with zero live codes because the second statement failed.
      await scope.codes.supersedeLiveForClient(actor.userId, now);
      await scope.codes.issue(actor.userId, codeHash, expiresAt);
    });

    return { code, expiresAt };
  }

  /**
   * A pure lookup: it identifies the client behind a code so the trainer can
   * then book them with book(). It writes nothing - the old handler minted a
   * permanent roster row on every call, so a trainer who typed a code and
   * never booked anyone still ended up rostered with that client, and roster
   * membership is the whole basis for a review.
   */
  async resolveAssignCode(actor: Actor, code: unknown): Promise<ResolvedAssignCode> {
    await this.requireTrainer(actor);
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      throw new ScheduleError("INVALID_INPUT", 400, "Code must have 6 digits");
    }

    const record = await this.deps.assignCodes.findLiveByHash(
      this.deps.codec.hash(code),
      this.deps.clock.now()
    );
    if (!record) {
      throw new ScheduleError("CODE_INVALID", 400, "Invalid or expired client code");
    }

    const client = await this.deps.participants.findActiveClientById(record.clientId);
    if (!client) {
      throw new ScheduleError("CLIENT_NOT_FOUND", 404, "Client for this code was not found");
    }

    return { assignCodeId: record.id, expiresAt: record.expiresAt, client };
  }

  async listPendingAssignCodes(
    actor: Actor
  ): Promise<Array<AssignCodeRecord & { client: ClientRecord }>> {
    const trainer = await this.requireTrainer(actor);
    return this.deps.reads
      .forTrainer(trainer.id)
      .listLiveRosterAssignCodes(this.deps.clock.now(), this.pendingCodeLimit);
  }
}
