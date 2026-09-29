import { Op, Transaction } from "sequelize";
import { ClientCheckInCode } from "../../../models/clientCheckInCode";
import { ClientSessionPack } from "../../../models/clientSessionPack";
import { TrainerBlockedDate } from "../../../models/trainerBlockedDate";
import { TrainerClient } from "../../../models/trainerClient";
import { TrainerScheduleSlot } from "../../../models/trainerScheduleSlot";
import { TrainerWorkingHour } from "../../../models/trainerWorkingHour";
import { User } from "../../../models/user";
import { SlotStatus } from "../../../types/schedule";
import {
  AssignCodeRecord,
  BlockedDayView,
  ClientRecord,
  ClientScope,
  ScheduleReads,
  TrainerScope,
} from "../ports";
import { DateKey, Interval, PackView, SlotView, WorkingHourView } from "../types";
import {
  toAssignCodeRecord,
  toBlockedDayView,
  toClientRecord,
  toPackView,
  toSlotView,
  toWorkingHourView,
} from "./rowMappers";

const clientInclude = [
  { model: User, as: "client", attributes: ["id", "firstName", "lastName", "email"] },
];

/**
 * Every query below starts from the trainerId captured in the constructor.
 * There is no method that takes a trainerId and none that omits one, so the
 * unscoped-query mistake (a `where` with no tenant predicate, which is
 * exactly how getPendingClientCodes leaked every client's live code to every
 * trainer) has nowhere to live.
 */
export class SequelizeTrainerScope implements TrainerScope {
  constructor(
    readonly trainerId: number,
    private readonly tx?: Transaction
  ) {}

  private get opts() {
    return this.tx ? { transaction: this.tx } : {};
  }

  async listSlotsInRange(range: Interval, opts?: { withClient?: boolean }): Promise<SlotView[]> {
    const rows = await TrainerScheduleSlot.findAll({
      where: {
        trainerId: this.trainerId,
        startsAt: { [Op.gte]: range.start, [Op.lt]: range.end },
      },
      ...(opts?.withClient ? { include: clientInclude } : {}),
      order: [["startsAt", "ASC"]],
      ...this.opts,
    });
    return rows.map(toSlotView);
  }

  async findOverlappingSlot(candidate: Interval, excludeSlotId?: number): Promise<SlotView | null> {
    // The SQL mirror of domain.overlaps: half-open [start, end).
    const row = await TrainerScheduleSlot.findOne({
      where: {
        trainerId: this.trainerId,
        startsAt: { [Op.lt]: candidate.end },
        endsAt: { [Op.gt]: candidate.start },
        ...(excludeSlotId ? { id: { [Op.ne]: excludeSlotId } } : {}),
      },
      ...this.opts,
    });
    return row ? toSlotView(row) : null;
  }

  async findClientBookingOnDay(
    clientId: number,
    day: Interval,
    excludeSlotId: number
  ): Promise<SlotView | null> {
    const row = await TrainerScheduleSlot.findOne({
      where: {
        trainerId: this.trainerId,
        clientId,
        id: { [Op.ne]: excludeSlotId },
        startsAt: { [Op.gte]: day.start, [Op.lt]: day.end },
        status: SlotStatus.ASSIGNED,
      },
      ...this.opts,
    });
    return row ? toSlotView(row) : null;
  }

  async listWorkingHours(opts?: { activeOnly?: boolean }): Promise<WorkingHourView[]> {
    const rows = await TrainerWorkingHour.findAll({
      where: {
        trainerId: this.trainerId,
        ...(opts?.activeOnly ? { isActive: true } : {}),
      },
      order: [["dayOfWeek", "ASC"]],
      ...this.opts,
    });
    return rows.map(toWorkingHourView);
  }

  async findWorkingHourForWeekday(
    dayOfWeek: number,
    opts?: { activeOnly?: boolean }
  ): Promise<WorkingHourView | null> {
    const row = await TrainerWorkingHour.findOne({
      where: {
        trainerId: this.trainerId,
        dayOfWeek,
        ...(opts?.activeOnly ? { isActive: true } : {}),
      },
      ...this.opts,
    });
    return row ? toWorkingHourView(row) : null;
  }

  async listBlockedDays(range?: { fromKey: DateKey; toKey: DateKey }): Promise<BlockedDayView[]> {
    const rows = await TrainerBlockedDate.findAll({
      where: {
        trainerId: this.trainerId,
        ...(range ? { date: { [Op.between]: [range.fromKey, range.toKey] } } : {}),
      },
      order: [["date", "ASC"]],
      ...this.opts,
    });
    return rows.map(toBlockedDayView);
  }

  async isDayBlocked(dateKey: DateKey): Promise<boolean> {
    const row = await TrainerBlockedDate.findOne({
      where: { trainerId: this.trainerId, date: dateKey },
      ...this.opts,
    });
    return row !== null;
  }

  async listPacksForClient(clientId: number): Promise<PackView[]> {
    const rows = await ClientSessionPack.findAll({
      where: { trainerId: this.trainerId, clientId },
      ...this.opts,
    });
    return rows.map(toPackView);
  }

  async listRosterClientIds(): Promise<number[]> {
    const rows = await TrainerClient.findAll({
      where: { trainerId: this.trainerId },
      attributes: ["clientId"],
      ...this.opts,
    });
    return rows.map((r) => r.clientId);
  }

  async listLiveRosterAssignCodes(
    now: Date,
    limit: number
  ): Promise<Array<AssignCodeRecord & { client: ClientRecord }>> {
    const rosterIds = await this.listRosterClientIds();
    if (rosterIds.length === 0) return [];

    const rows = await ClientCheckInCode.findAll({
      where: {
        clientId: { [Op.in]: rosterIds },
        consumedAt: null,
        expiresAt: { [Op.gt]: now },
      },
      include: [
        {
          model: User,
          as: "client",
          // isActive and role must be selected or the filter below silently
          // drops every row - the bug this endpoint shipped with.
          attributes: ["id", "firstName", "lastName", "email", "isActive", "role"],
        },
      ],
      order: [["expiresAt", "ASC"]],
      limit,
      ...this.opts,
    });

    const out: Array<AssignCodeRecord & { client: ClientRecord }> = [];
    for (const row of rows) {
      const client = (row as unknown as { client?: User }).client;
      if (!client || !client.isActive || String(client.role) !== "client") continue;
      out.push({ ...toAssignCodeRecord(row), client: toClientRecord(client) });
    }
    return out;
  }
}

export class SequelizeClientScope implements ClientScope {
  constructor(
    readonly clientId: number,
    private readonly tx?: Transaction
  ) {}

  private get opts() {
    return this.tx ? { transaction: this.tx } : {};
  }

  async findAssignedSlot(slotId: number): Promise<SlotView | null> {
    const row = await TrainerScheduleSlot.findOne({
      where: { id: slotId, clientId: this.clientId },
      ...this.opts,
    });
    return row ? toSlotView(row) : null;
  }

  async listBookingsInRange(range: Interval): Promise<SlotView[]> {
    const rows = await TrainerScheduleSlot.findAll({
      where: {
        clientId: this.clientId,
        startsAt: { [Op.gte]: range.start, [Op.lt]: range.end },
        status: SlotStatus.ASSIGNED,
      },
      // The old handler also eager-loaded the Trainer here, under Sequelize's
      // default "Trainer" key. Nothing on the client ever read it - not the
      // screen, not the declared ScheduleSlot type - so it is not carried over.
      order: [["startsAt", "ASC"]],
      ...this.opts,
    });
    return rows.map(toSlotView);
  }
}

export class SequelizeScheduleReads implements ScheduleReads {
  forTrainer(trainerId: number): TrainerScope {
    return new SequelizeTrainerScope(trainerId);
  }

  forClient(clientId: number): ClientScope {
    return new SequelizeClientScope(clientId);
  }
}
