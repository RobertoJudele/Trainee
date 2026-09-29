// Row -> domain value. The single place a Sequelize model instance becomes a
// plain object, so a model - with its .update()/.destroy()/.increment() - can
// never reach domain.ts and smuggle I/O into a "pure" function. Mirrors the
// role trainerBillingState.ts plays for the billing module.
import { ClientSessionPack } from "../../../models/clientSessionPack";
import { TrainerBlockedDate } from "../../../models/trainerBlockedDate";
import { TrainerScheduleSlot } from "../../../models/trainerScheduleSlot";
import { TrainerWorkingHour } from "../../../models/trainerWorkingHour";
import { User } from "../../../models/user";
import { ClientCheckInCode } from "../../../models/clientCheckInCode";
import { AssignCodeRecord, BlockedDayView, ClientRecord } from "../ports";
import { PackView, SlotParticipant, SlotView, WorkingHourView } from "../types";

const toSlotParticipant = (row: User): SlotParticipant => ({
  id: row.id,
  email: row.email,
  firstName: row.firstName,
  lastName: row.lastName,
});

export const toSlotView = (row: TrainerScheduleSlot): SlotView => {
  // `client` exists on the instance only when the query included it; an
  // absent association and a genuinely unbooked slot are different facts, so
  // the field stays undefined rather than collapsing to null.
  const included = (row as unknown as { client?: User | null }).client;
  return {
    id: row.id,
    trainerId: row.trainerId,
    clientId: row.clientId ?? null,
    workingHourId: row.workingHourId ?? null,
    startsAt: new Date(row.startsAt),
    endsAt: new Date(row.endsAt),
    note: row.note ?? null,
    ...(included === undefined ? {} : { client: included ? toSlotParticipant(included) : null }),
  };
};

export const toWorkingHourView = (row: TrainerWorkingHour): WorkingHourView => ({
  id: row.id,
  trainerId: row.trainerId,
  dayOfWeek: row.dayOfWeek,
  startTime: row.startTime,
  endTime: row.endTime,
  slotDurationMin: row.slotDurationMin,
  isActive: row.isActive,
});

export const toBlockedDayView = (row: TrainerBlockedDate): BlockedDayView => ({
  id: row.id,
  trainerId: row.trainerId,
  date: row.date,
  reason: row.reason ?? null,
});

export const toPackView = (row: ClientSessionPack): PackView => ({
  id: row.id,
  totalSessions: row.totalSessions,
  usedSessions: row.usedSessions,
  createdAt: new Date(row.createdAt),
});

export const toClientRecord = (row: User): ClientRecord => ({
  id: row.id,
  role: String(row.role),
  isActive: row.isActive,
  firstName: row.firstName,
  lastName: row.lastName,
  email: row.email,
});

export const toAssignCodeRecord = (row: ClientCheckInCode): AssignCodeRecord => ({
  id: row.id,
  clientId: row.clientId,
  expiresAt: new Date(row.expiresAt),
});
