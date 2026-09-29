import { Op, Sequelize, Transaction } from "sequelize";
import { ClientCheckInCode } from "../../../models/clientCheckInCode";
import { ClientSessionPack } from "../../../models/clientSessionPack";
import { TrainerBlockedDate } from "../../../models/trainerBlockedDate";
import { TrainerClient } from "../../../models/trainerClient";
import { TrainerScheduleSlot } from "../../../models/trainerScheduleSlot";
import { TrainerWorkingHour } from "../../../models/trainerWorkingHour";
import { SlotStatus } from "../../../types/schedule";
import {
  AssignCodeRecord,
  AssignCodeWriter,
  BlockedDayWriter,
  ClientWriteScope,
  PackWriter,
  RosterWriter,
  ScheduleUnitOfWork,
  SlotWriter,
  WorkingHourWriter,
  WriteScope,
} from "../ports";
import { DateKey, PlannedSlot, SlotView, WorkingHourView } from "../types";
import {
  toAssignCodeRecord,
  toBlockedDayView,
  toSlotView,
  toWorkingHourView,
} from "./rowMappers";
import { SequelizeTrainerScope } from "./SequelizeScheduleReads";

class SequelizeSlotWriter implements SlotWriter {
  constructor(
    private readonly trainerId: number,
    private readonly tx: Transaction
  ) {}

  /** Every write goes through this. There is no unscoped variant, so a
   *  handler cannot mutate another trainer's slot by id. */
  private ownershipWhere(slotId: number) {
    return { id: slotId, trainerId: this.trainerId };
  }

  async lockSlot(slotId: number): Promise<SlotView | null> {
    const row = await TrainerScheduleSlot.findOne({
      where: this.ownershipWhere(slotId),
      lock: Transaction.LOCK.UPDATE,
      transaction: this.tx,
    });
    return row ? toSlotView(row) : null;
  }

  async assign(slotId: number, to: { clientId: number; note: string | null }): Promise<SlotView> {
    await TrainerScheduleSlot.update(
      { clientId: to.clientId, note: to.note ?? undefined, status: SlotStatus.ASSIGNED },
      { where: this.ownershipWhere(slotId), transaction: this.tx }
    );
    const row = await TrainerScheduleSlot.findOne({
      where: this.ownershipWhere(slotId),
      transaction: this.tx,
    });
    return toSlotView(row!);
  }

  async release(slotId: number): Promise<SlotView> {
    await TrainerScheduleSlot.update(
      {
        clientId: null as unknown as undefined,
        note: null as unknown as undefined,
        status: SlotStatus.AVAILABLE,
      },
      { where: this.ownershipWhere(slotId), transaction: this.tx }
    );
    const row = await TrainerScheduleSlot.findOne({
      where: this.ownershipWhere(slotId),
      transaction: this.tx,
    });
    return toSlotView(row!);
  }

  async createMany(rows: readonly PlannedSlot[]): Promise<SlotView[]> {
    if (rows.length === 0) return [];
    const created = await TrainerScheduleSlot.bulkCreate(
      rows.map((r) => ({
        trainerId: this.trainerId,
        workingHourId: r.workingHourId ?? undefined,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        status: SlotStatus.AVAILABLE,
      })),
      { transaction: this.tx }
    );
    return created.map(toSlotView);
  }

  async createOne(row: PlannedSlot & { note: string | null }): Promise<SlotView> {
    const created = await TrainerScheduleSlot.create(
      {
        trainerId: this.trainerId,
        workingHourId: row.workingHourId ?? undefined,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        note: row.note ?? undefined,
        status: SlotStatus.AVAILABLE,
      },
      { transaction: this.tx }
    );
    return toSlotView(created);
  }

  async deleteById(slotId: number): Promise<void> {
    await TrainerScheduleSlot.destroy({
      where: this.ownershipWhere(slotId),
      transaction: this.tx,
    });
  }

  async deleteByIds(slotIds: readonly number[]): Promise<number> {
    if (slotIds.length === 0) return 0;
    return TrainerScheduleSlot.destroy({
      where: {
        id: { [Op.in]: [...slotIds] },
        trainerId: this.trainerId,
      },
      transaction: this.tx,
    });
  }
}

class SequelizePackWriter implements PackWriter {
  constructor(private readonly tx: Transaction) {}

  async setUsedSessions(packId: number, usedSessions: number): Promise<void> {
    await ClientSessionPack.update({ usedSessions }, { where: { id: packId }, transaction: this.tx });
  }
}

class SequelizeRosterWriter implements RosterWriter {
  constructor(
    private readonly trainerId: number,
    private readonly tx: Transaction
  ) {}

  async ensureMember(clientId: number): Promise<void> {
    // findOrCreate would abort the enclosing transaction on the unique-index
    // race that (trainer_id, client_id) makes reachable when a client is
    // assigned to two slots concurrently. ignoreDuplicates gives
    // INSERT ... ON CONFLICT DO NOTHING, which cannot.
    await TrainerClient.bulkCreate([{ trainerId: this.trainerId, clientId }], {
      ignoreDuplicates: true,
      transaction: this.tx,
    });
  }
}

class SequelizeAssignCodeWriter implements AssignCodeWriter {
  constructor(private readonly tx: Transaction) {}

  async supersedeLiveForClient(clientId: number, at: Date): Promise<number> {
    const [affected] = await ClientCheckInCode.update(
      { consumedAt: at, consumedByUserId: clientId },
      {
        where: { clientId, consumedAt: null, expiresAt: { [Op.gt]: at } },
        transaction: this.tx,
      }
    );
    return affected;
  }

  async issue(clientId: number, codeHash: string, expiresAt: Date): Promise<AssignCodeRecord> {
    const row = await ClientCheckInCode.create(
      { clientId, codeHash, expiresAt },
      { transaction: this.tx }
    );
    return toAssignCodeRecord(row);
  }
}

class SequelizeWorkingHourWriter implements WorkingHourWriter {
  constructor(
    private readonly trainerId: number,
    private readonly tx: Transaction
  ) {}

  async upsert(input: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMin?: number;
    isActive?: boolean;
  }): Promise<{ row: WorkingHourView; created: boolean }> {
    const existing = await TrainerWorkingHour.findOne({
      where: { trainerId: this.trainerId, dayOfWeek: input.dayOfWeek },
      transaction: this.tx,
    });

    if (existing) {
      await existing.update(
        {
          startTime: input.startTime,
          endTime: input.endTime,
          slotDurationMin: input.slotDurationMin ?? existing.slotDurationMin,
          isActive: input.isActive ?? existing.isActive,
        },
        { transaction: this.tx }
      );
      return { row: toWorkingHourView(existing), created: false };
    }

    const created = await TrainerWorkingHour.create(
      {
        trainerId: this.trainerId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        slotDurationMin: input.slotDurationMin ?? 60,
        isActive: input.isActive ?? true,
      },
      { transaction: this.tx }
    );
    return { row: toWorkingHourView(created), created: true };
  }
}

class SequelizeBlockedDayWriter implements BlockedDayWriter {
  constructor(
    private readonly trainerId: number,
    private readonly tx: Transaction
  ) {}

  async block(dateKey: DateKey, reason: string | null) {
    const existing = await TrainerBlockedDate.findOne({
      where: { trainerId: this.trainerId, date: dateKey },
      transaction: this.tx,
    });
    if (existing) {
      if (reason !== null && existing.reason !== reason) {
        await existing.update({ reason }, { transaction: this.tx });
      }
      return toBlockedDayView(existing);
    }
    const created = await TrainerBlockedDate.create(
      { trainerId: this.trainerId, date: dateKey, reason: reason ?? undefined },
      { transaction: this.tx }
    );
    return toBlockedDayView(created);
  }

  async unblock(dateKey: DateKey): Promise<void> {
    await TrainerBlockedDate.destroy({
      where: { trainerId: this.trainerId, date: dateKey },
      transaction: this.tx,
    });
  }
}

/**
 * The only file in the module that knows what a Sequelize Transaction is.
 *
 * The transaction is handed out as a *scope* holding already-bound
 * repositories, never as a parameter threaded through method signatures.
 * That keeps `Transaction` out of ports.ts entirely - which matters because
 * the moment a port method takes one, someone eventually passes it into
 * domain.ts "just for this one query" and the pure layer stops being pure.
 * There is no Sequelize.useCLS in this codebase, so the transaction cannot be
 * ambient; the scope is the thread, made invisible to the caller.
 */
export class SequelizeScheduleUnitOfWork implements ScheduleUnitOfWork {
  constructor(private readonly sequelize: Sequelize) {}

  private makeAttempt(tx: Transaction) {
    return async <T>(
      label: string,
      work: () => Promise<T>
    ): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> => {
      try {
        // A nested transaction on the same connection is a SAVEPOINT, so a
        // failure here rolls back only this step and leaves the enclosing
        // transaction usable. A plain try/catch cannot do this: in Postgres a
        // failed statement poisons the whole transaction (25P02).
        const value = await this.sequelize.transaction({ transaction: tx }, async () => work());
        return { ok: true, value };
      } catch (error) {
        console.error(`Schedule step "${label}" failed and was rolled back:`, error);
        return { ok: false, error };
      }
    };
  }

  async runForTrainer<T>(
    trainerId: number,
    work: (scope: WriteScope) => Promise<T>
  ): Promise<T> {
    return this.sequelize.transaction(async (tx) => {
      const scope: WriteScope = {
        trainerId,
        slots: new SequelizeSlotWriter(trainerId, tx),
        packs: new SequelizePackWriter(tx),
        roster: new SequelizeRosterWriter(trainerId, tx),
        codes: new SequelizeAssignCodeWriter(tx),
        workingHours: new SequelizeWorkingHourWriter(trainerId, tx),
        blockedDays: new SequelizeBlockedDayWriter(trainerId, tx),
        read: new SequelizeTrainerScope(trainerId, tx),
        attempt: this.makeAttempt(tx),
      };
      return work(scope);
    });
  }

  async runForClient<T>(
    clientId: number,
    work: (scope: ClientWriteScope) => Promise<T>
  ): Promise<T> {
    return this.sequelize.transaction(async (tx) => {
      const scope: ClientWriteScope = {
        clientId,
        codes: new SequelizeAssignCodeWriter(tx),
      };
      return work(scope);
    });
  }
}
