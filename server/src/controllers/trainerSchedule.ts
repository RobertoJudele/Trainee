import crypto from "crypto";
import { Request, Response } from "express";
import { Op } from "sequelize";
import { ClientCheckInCode } from "../models/clientCheckInCode";
import { Trainer } from "../models/trainer";
import { TrainerScheduleSlot } from "../models/trainerScheduleSlot";
import { TrainerWorkingHour } from "../models/trainerWorkingHour";
import { TrainerBlockedDate } from "../models/trainerBlockedDate";
import { User } from "../models/user";
import { SlotStatus, TrainerScheduleSlotCreationAttributes } from "../types/schedule";
import { sendError, sendSuccess } from "../utils/response";
import { getRequiredEnv } from "../config/env";
import {
  addDaysToKey,
  dateKeyWeekday,
  dayDiff,
  extractDateKey,
  isDateKey,
  parseTimeToMinutes as parseTimeToMinutesTz,
  resolveTimeZone,
  zonedDayBoundsUtc,
  zonedWallClockToUtc,
} from "../utils/scheduleTime";

// Maximum span (in days) a single generate request may cover.
const MAX_GENERATE_RANGE_DAYS = 62;

const parseTimeToMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const toDateAtMinutes = (day: Date, minutes: number): Date => {
  const date = new Date(day);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minutes);
  return date;
};

const buildCheckInCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const CHECKIN_CODE_SECRET = getRequiredEnv("CHECKIN_CODE_SECRET");

const hashCheckInCode = (code: string) => {
  return crypto
    .createHash("sha256")
    .update(`${code}:${CHECKIN_CODE_SECRET}`)
    .digest("hex");
};

const getTrainerByUserId = async (userId: number) => {
  return Trainer.findOne({ where: { userId } });
};

const toDayBounds = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const parseDateQuery = (rawValue: unknown, endOfDay: boolean) => {
  if (!rawValue) return null;
  const text = String(rawValue);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;

  // When receiving YYYY-MM-DD, normalize to full-day boundaries.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
  }

  return date;
};

const ensureNoDuplicateClientOnDay = async (
  trainerId: number,
  clientId: number,
  slotId: number,
  slotStart: Date
) => {
  const { start, end } = toDayBounds(slotStart);

  const duplicate = await TrainerScheduleSlot.findOne({
    where: {
      trainerId,
      clientId,
      id: { [Op.ne]: slotId },
      startsAt: { [Op.between]: [start, end] },
      status: { [Op.in]: [SlotStatus.ASSIGNED, SlotStatus.COMPLETED] },
    },
  });

  return Boolean(duplicate);
};

export const upsertWorkingHour = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "trainer") {
      sendError(res, 403, "Trainer access required");
      return;
    }

    const trainer = await getTrainerByUserId(user.id);
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const {
      dayOfWeek,
      startTime,
      endTime,
      slotDurationMin,
      isActive,
    } = req.body as {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      slotDurationMin?: number;
      isActive?: boolean;
    };

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      sendError(res, 400, "dayOfWeek must be an integer between 0 and 6");
      return;
    }

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(startTime) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(endTime)) {
      sendError(res, 400, "startTime and endTime must be HH:mm");
      return;
    }

    if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
      sendError(res, 400, "endTime must be after startTime");
      return;
    }

    const existing = await TrainerWorkingHour.findOne({
      where: { trainerId: trainer.id, dayOfWeek },
    });

    if (existing) {
      await existing.update({
        startTime,
        endTime,
        slotDurationMin: slotDurationMin || existing.slotDurationMin,
        isActive: typeof isActive === "boolean" ? isActive : existing.isActive,
      });

      sendSuccess(res, 200, "Working hour updated", existing);
      return;
    }

    const record = await TrainerWorkingHour.create({
      trainerId: trainer.id,
      dayOfWeek,
      startTime,
      endTime,
      slotDurationMin: slotDurationMin || 60,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    sendSuccess(res, 201, "Working hour created", record);
  } catch (error) {
    console.error("Failed to upsert working hour:", error);
    sendError(res, 500, "Could not save working hour");
  }
};

export const getWorkingHours = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "trainer") {
      sendError(res, 403, "Trainer access required");
      return;
    }

    const trainer = await getTrainerByUserId(user.id);
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const rows = await TrainerWorkingHour.findAll({
      where: { trainerId: trainer.id },
      order: [["dayOfWeek", "ASC"]],
    });

    sendSuccess(res, 200, "Working hours retrieved", rows);
  } catch (error) {
    console.error("Failed to get working hours:", error);
    sendError(res, 500, "Could not retrieve working hours");
  }
};

export const generateSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "trainer") {
      sendError(res, 403, "Trainer access required");
      return;
    }

    const trainer = await getTrainerByUserId(user.id);
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const { fromDate, toDate, timeZone } = req.body as {
      fromDate: string;
      toDate: string;
      timeZone?: string;
    };

    const tz = resolveTimeZone(timeZone);
    const fromKey = extractDateKey(String(fromDate), tz);
    const toKey = extractDateKey(String(toDate), tz);

    if (!fromKey || !toKey || dayDiff(fromKey, toKey) < 0) {
      sendError(res, 400, "Invalid date range");
      return;
    }

    if (dayDiff(fromKey, toKey) > MAX_GENERATE_RANGE_DAYS) {
      sendError(res, 400, `Date range too large (max ${MAX_GENERATE_RANGE_DAYS} days)`);
      return;
    }

    const templates = await TrainerWorkingHour.findAll({
      where: { trainerId: trainer.id, isActive: true },
    });

    if (templates.length === 0) {
      sendError(res, 400, "No active working-hour templates found");
      return;
    }

    // Blocked days in range — skip these entirely.
    const blockedRows = await TrainerBlockedDate.findAll({
      where: { trainerId: trainer.id, date: { [Op.between]: [fromKey, toKey] } },
      attributes: ["date"],
    });
    const blockedKeys = new Set(blockedRows.map((r) => r.date));

    // Existing slots in the range — dedup on startsAt without N+1 queries.
    const rangeStart = zonedDayBoundsUtc(fromKey, tz).start;
    const rangeEnd = zonedDayBoundsUtc(toKey, tz).end;
    const existingSlots = await TrainerScheduleSlot.findAll({
      where: {
        trainerId: trainer.id,
        startsAt: { [Op.between]: [rangeStart, rangeEnd] },
      },
      attributes: ["startsAt"],
    });
    const existingStartEpochs = new Set(
      existingSlots.map((s) => new Date(s.startsAt).getTime())
    );

    const toCreate: Array<{
      trainerId: number;
      workingHourId: number;
      startsAt: Date;
      endsAt: Date;
      status: SlotStatus;
    }> = [];

    for (let dayKey = fromKey; dayDiff(dayKey, toKey) >= 0; dayKey = addDaysToKey(dayKey, 1)) {
      if (blockedKeys.has(dayKey)) {
        continue;
      }

      const weekday = dateKeyWeekday(dayKey);
      const dayTemplates = templates.filter((t) => t.dayOfWeek === weekday);

      for (const template of dayTemplates) {
        const startMin = parseTimeToMinutesTz(template.startTime);
        const endMin = parseTimeToMinutesTz(template.endTime);
        const duration = template.slotDurationMin;

        for (let minute = startMin; minute + duration <= endMin; minute += duration) {
          const startsAt = zonedWallClockToUtc(dayKey, minute, tz);
          if (existingStartEpochs.has(startsAt.getTime())) {
            continue;
          }
          existingStartEpochs.add(startsAt.getTime());

          toCreate.push({
            trainerId: trainer.id,
            workingHourId: template.id,
            startsAt,
            endsAt: zonedWallClockToUtc(dayKey, minute + duration, tz),
            status: SlotStatus.AVAILABLE,
          });
        }
      }
    }

    const created = toCreate.length
      ? await TrainerScheduleSlot.bulkCreate(toCreate)
      : [];

    sendSuccess(res, 201, "Slots generated", { count: created.length, slots: created });
  } catch (error) {
    console.error("Failed to generate slots:", error);
    sendError(res, 500, "Could not generate slots");
  }
};

export const getTrainerSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "trainer") {
      sendError(res, 403, "Trainer access required");
      return;
    }

    const trainer = await getTrainerByUserId(user.id);
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const from = parseDateQuery(req.query.from, false) || new Date();
    const to =
      parseDateQuery(req.query.to, true) ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const slots = await TrainerScheduleSlot.findAll({
      where: {
        trainerId: trainer.id,
        startsAt: { [Op.between]: [from, to] },
      },
      include: [{ model: User, as: "client", attributes: ["id", "firstName", "lastName", "email"] }],
      order: [["startsAt", "ASC"]],
    });

    sendSuccess(res, 200, "Trainer slots retrieved", slots);
  } catch (error) {
    console.error("Failed to get trainer slots:", error);
    sendError(res, 500, "Could not retrieve trainer slots");
  }
};

export const assignClientToSlot = async (req: Request<{ slotId: string }>, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "trainer") {
      sendError(res, 403, "Trainer access required");
      return;
    }

    const trainer = await getTrainerByUserId(user.id);
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const slotId = Number(req.params.slotId);
    const { clientId, note } = req.body as { clientId: number; note?: string };

    if (!Number.isFinite(slotId) || slotId <= 0) {
      sendError(res, 400, "Invalid slot id");
      return;
    }

    if (!Number.isFinite(clientId) || clientId <= 0) {
      sendError(res, 400, "Invalid client id");
      return;
    }

    const client = await User.findByPk(clientId);
    if (!client || !client.isActive) {
      sendError(res, 404, "Client not found");
      return;
    }

    const slot = await TrainerScheduleSlot.findOne({ where: { id: slotId, trainerId: trainer.id } });
    if (!slot) {
      sendError(res, 404, "Slot not found");
      return;
    }

    if (slot.status !== SlotStatus.AVAILABLE) {
      sendError(res, 400, "Slot is not available");
      return;
    }

    const alreadyAssignedThatDay = await ensureNoDuplicateClientOnDay(
      trainer.id,
      clientId,
      slot.id,
      slot.startsAt
    );
    if (alreadyAssignedThatDay) {
      sendError(res, 409, "This client is already assigned on the selected day");
      return;
    }

    await slot.update({
      clientId,
      note,
      status: SlotStatus.ASSIGNED,
      checkInCodeHash: null,
      checkInCodeExpiresAt: null,
      checkInAttempts: 0,
      checkedInAt: null,
    });

    sendSuccess(res, 200, "Client assigned to slot", {
      slot,
    });
  } catch (error) {
    console.error("Failed to assign client to slot:", error);
    sendError(res, 500, "Could not assign client to slot");
  }
};

export const unassignClientFromSlot = async (
  req: Request<{ slotId: string }>,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 401, "Authentication required");
      return;
    }

    const slotId = Number(req.params.slotId);
    if (!Number.isFinite(slotId) || slotId <= 0) {
      sendError(res, 400, "Invalid slot id");
      return;
    }

    let slot: TrainerScheduleSlot | null = null;

    if (user.role === "trainer") {
      const trainer = await getTrainerByUserId(user.id);
      if (!trainer) {
        sendError(res, 404, "Trainer profile not found");
        return;
      }
      slot = await TrainerScheduleSlot.findOne({ where: { id: slotId, trainerId: trainer.id } });
    } else if (user.role === "client") {
      // Clients can cancel only their own assigned slot
      slot = await TrainerScheduleSlot.findOne({ where: { id: slotId, clientId: user.id } });
    } else {
      sendError(res, 403, "Access denied");
      return;
    }

    if (!slot) {
      sendError(res, 404, "Slot not found");
      return;
    }

    if (slot.status === SlotStatus.AVAILABLE) {
      sendSuccess(res, 200, "Slot is already available", { slot });
      return;
    }

    if (slot.status === SlotStatus.COMPLETED) {
      sendError(res, 400, "Cannot cancel a completed session");
      return;
    }

    await slot.update({
      clientId: null,
      note: null,
      status: SlotStatus.AVAILABLE,
      checkInCodeHash: null,
      checkInCodeExpiresAt: null,
      checkInAttempts: 0,
      checkedInAt: null,
    } as any);

    sendSuccess(res, 200, "Client unassigned from slot", { slot });
  } catch (error) {
    console.error("Failed to unassign client from slot:", error);
    sendError(res, 500, "Could not unassign client from slot");
  }
};

export const generateClientCheckInCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "client") {
      sendError(res, 403, "Client access required");
      return;
    }

    const now = new Date();
    const ttlMinutes = 10;

    const code = buildCheckInCode();
    const codeHash = hashCheckInCode(code);
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    await ClientCheckInCode.update(
      { consumedAt: now, consumedByUserId: user.id },
      {
        where: {
          clientId: user.id,
          consumedAt: null,
          expiresAt: { [Op.gt]: now },
        },
      }
    );

    await ClientCheckInCode.create({
      clientId: user.id,
      codeHash,
      expiresAt,
    });

    sendSuccess(res, 200, "Check-in code generated", {
      code,
      expiresAt,
    });
  } catch (error) {
    console.error("Failed to generate client check-in code:", error);
    sendError(res, 500, "Could not generate check-in code");
  }
};

export const assignSlotByClientCode = async (
  req: Request<{ slotId: string }>,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "trainer") {
      sendError(res, 403, "Trainer access required");
      return;
    }

    const trainer = await getTrainerByUserId(user.id);
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const slotId = Number(req.params.slotId);
    const { code, note } = req.body as { code?: string; note?: string };

    if (!Number.isFinite(slotId) || slotId <= 0) {
      sendError(res, 400, "Invalid slot id");
      return;
    }

    if (!code || !/^\d{6}$/.test(code)) {
      sendError(res, 400, "Code must have 6 digits");
      return;
    }

    const slot = await TrainerScheduleSlot.findOne({ where: { id: slotId, trainerId: trainer.id } });
    if (!slot) {
      sendError(res, 404, "Slot not found");
      return;
    }

    if (slot.status !== SlotStatus.AVAILABLE) {
      sendError(res, 400, "Slot is not available");
      return;
    }

    const now = new Date();
    const codeHash = hashCheckInCode(code);
    const generatedCode = await ClientCheckInCode.findOne({
      where: {
        codeHash,
        consumedAt: null,
        expiresAt: { [Op.gt]: now },
      },
    });

    if (!generatedCode) {
      sendError(res, 400, "Invalid or expired client code");
      return;
    }

    const client = await User.findByPk(generatedCode.clientId);
    if (!client || !client.isActive || client.role !== "client") {
      sendError(res, 404, "Client for this code was not found");
      return;
    }

    const alreadyAssignedThatDay = await ensureNoDuplicateClientOnDay(
      trainer.id,
      generatedCode.clientId,
      slot.id,
      slot.startsAt
    );
    if (alreadyAssignedThatDay) {
      sendError(res, 409, "This client is already assigned on the selected day");
      return;
    }

    await slot.update({
      clientId: generatedCode.clientId,
      note,
      status: SlotStatus.ASSIGNED,
      checkInCodeHash: null,
      checkInCodeExpiresAt: null,
      checkInAttempts: 0,
    });

    await generatedCode.update({
      consumedAt: now,
      consumedByUserId: user.id,
    });

    sendSuccess(res, 200, "Slot assigned using client code", {
      slot,
    });
  } catch (error) {
    console.error("Failed to assign slot by client code:", error);
    sendError(res, 500, "Could not assign slot by client code");
  }
};

export const trainerCheckInSlot = async (req: Request<{ slotId: string }>, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "trainer") {
      sendError(res, 403, "Trainer access required");
      return;
    }

    const trainer = await getTrainerByUserId(user.id);
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const slotId = Number(req.params.slotId);
    const { code } = req.body as { code: string };

    const slot = await TrainerScheduleSlot.findOne({ where: { id: slotId, trainerId: trainer.id } });
    if (!slot) {
      sendError(res, 404, "Slot not found");
      return;
    }

    if (slot.status !== SlotStatus.ASSIGNED) {
      sendError(res, 400, "Slot is not awaiting check-in");
      return;
    }

    if (!slot.checkInCodeHash) {
      sendError(res, 400, "Client has not generated a check-in code yet");
      return;
    }

    if (slot.checkInCodeExpiresAt && slot.checkInCodeExpiresAt < new Date()) {
      sendError(res, 400, "Check-in code expired");
      return;
    }

    if (slot.checkInAttempts >= 3) {
      sendError(res, 429, "Too many invalid code attempts");
      return;
    }

    const hash = hashCheckInCode(code);
    if (hash !== slot.checkInCodeHash) {
      slot.checkInAttempts += 1;
      await slot.save();
      sendError(res, 400, "Invalid check-in code");
      return;
    }

    await slot.update({
      status: SlotStatus.COMPLETED,
      checkedInAt: new Date(),
      checkInCodeHash: null,
      checkInCodeExpiresAt: null,
      checkInAttempts: 0,
    });

    sendSuccess(res, 200, "Client check-in confirmed", slot);
  } catch (error) {
    console.error("Failed to check in slot:", error);
    sendError(res, 500, "Could not confirm check-in");
  }
};

export const getPendingClientCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "trainer") {
      sendError(res, 403, "Trainer access required");
      return;
    }

    const now = new Date();
    const codes = await ClientCheckInCode.findAll({
      where: {
        consumedAt: null,
        expiresAt: { [Op.gt]: now },
      },
      include: [{ model: User, as: "client", attributes: ["id", "firstName", "lastName", "email"] }],
      order: [["expiresAt", "ASC"]],
      limit: 100,
    });

    const data = codes
      .map((record) => {
        const client = (record as any).client as User | undefined;
        if (!client || !client.isActive || client.role !== "client") return null;
        return {
          checkInCodeId: record.id,
          expiresAt: record.expiresAt,
          client: {
            id: client.id,
            email: client.email,
            firstName: client.firstName,
            lastName: client.lastName,
          },
        };
      })
      .filter(Boolean);

    sendSuccess(res, 200, "Pending client codes retrieved", data);
  } catch (error) {
    console.error("Failed to get pending client codes:", error);
    sendError(res, 500, "Could not retrieve pending client codes");
  }
};

export const resolveClientCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "trainer") {
      sendError(res, 403, "Trainer access required");
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code || !/^\d{6}$/.test(code)) {
      sendError(res, 400, "Code must have 6 digits");
      return;
    }

    const now = new Date();
    const codeHash = hashCheckInCode(code);
    const record = await ClientCheckInCode.findOne({
      where: {
        codeHash,
        consumedAt: null,
        expiresAt: { [Op.gt]: now },
      },
    });

    if (!record) {
      sendError(res, 400, "Invalid or expired client code");
      return;
    }

    const client = await User.findByPk(record.clientId);
    if (!client || !client.isActive || client.role !== "client") {
      sendError(res, 404, "Client for this code was not found");
      return;
    }

    sendSuccess(res, 200, "Client code resolved", {
      checkInCodeId: record.id,
      expiresAt: record.expiresAt,
      client: {
        id: client.id,
        email: client.email,
        firstName: client.firstName,
        lastName: client.lastName,
      },
    });
  } catch (error) {
    console.error("Failed to resolve client code:", error);
    sendError(res, 500, "Could not resolve client code");
  }
};

export const assignSlotByCodeId = async (
  req: Request<{ slotId: string }>,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "trainer") {
      sendError(res, 403, "Trainer access required");
      return;
    }

    const trainer = await getTrainerByUserId(user.id);
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const slotId = Number(req.params.slotId);
    const { checkInCodeId, note } = req.body as { checkInCodeId?: number; note?: string };

    if (!Number.isFinite(slotId) || slotId <= 0) {
      sendError(res, 400, "Invalid slot id");
      return;
    }

    if (!Number.isFinite(checkInCodeId) || Number(checkInCodeId) <= 0) {
      sendError(res, 400, "Invalid check-in code id");
      return;
    }

    const slot = await TrainerScheduleSlot.findOne({ where: { id: slotId, trainerId: trainer.id } });
    if (!slot) {
      sendError(res, 404, "Slot not found");
      return;
    }

    if (slot.status !== SlotStatus.AVAILABLE) {
      sendError(res, 400, "Slot is not available");
      return;
    }

    const now = new Date();
    const codeRecord = await ClientCheckInCode.findOne({
      where: {
        id: Number(checkInCodeId),
        consumedAt: null,
        expiresAt: { [Op.gt]: now },
      },
    });
    if (!codeRecord) {
      sendError(res, 400, "Check-in code is invalid or expired");
      return;
    }

    const client = await User.findByPk(codeRecord.clientId);
    if (!client || !client.isActive || client.role !== "client") {
      sendError(res, 404, "Client for this code was not found");
      return;
    }

    const alreadyAssignedThatDay = await ensureNoDuplicateClientOnDay(
      trainer.id,
      codeRecord.clientId,
      slot.id,
      slot.startsAt
    );
    if (alreadyAssignedThatDay) {
      sendError(res, 409, "This client is already assigned on the selected day");
      return;
    }

    await slot.update({
      clientId: codeRecord.clientId,
      note,
      status: SlotStatus.ASSIGNED,
      checkInCodeHash: null,
      checkInCodeExpiresAt: null,
      checkInAttempts: 0,
    });

    await codeRecord.update({
      consumedAt: now,
      consumedByUserId: user.id,
    });

    sendSuccess(res, 200, "Slot assigned using pending client code", {
      slot,
    });
  } catch (error) {
    console.error("Failed to assign slot by code id:", error);
    sendError(res, 500, "Could not assign slot by code id");
  }
};

export const getClientSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 401, "User not authenticated");
      return;
    }

    const from = req.query.from ? new Date(String(req.query.from)) : new Date();
    const to = req.query.to
      ? new Date(String(req.query.to))
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const slots = await TrainerScheduleSlot.findAll({
      where: {
        clientId: user.id,
        startsAt: { [Op.between]: [from, to] },
        status: { [Op.in]: [SlotStatus.ASSIGNED, SlotStatus.COMPLETED] },
      },
      include: [{ model: Trainer, attributes: ["id", "userId", "locationCity", "locationState"] }],
      order: [["startsAt", "ASC"]],
    });

    sendSuccess(res, 200, "Client schedule retrieved", slots);
  } catch (error) {
    console.error("Failed to get client schedule:", error);
    sendError(res, 500, "Could not retrieve client schedule");
  }
};

export const searchClientsForTrainer = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "trainer") {
      sendError(res, 403, "Trainer access required");
      return;
    }

    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      sendError(res, 400, "Query must have at least 2 characters");
      return;
    }

    const clients = await User.findAll({
      where: {
        role: "client",
        isActive: true,
        [Op.or]: [
          { email: { [Op.iLike]: `%${q}%` } },
          { firstName: { [Op.iLike]: `%${q}%` } },
          { lastName: { [Op.iLike]: `%${q}%` } },
        ],
      },
      attributes: ["id", "email", "firstName", "lastName"],
      limit: 15,
      order: [["firstName", "ASC"]],
    });

    sendSuccess(res, 200, "Clients found", clients);
  } catch (error) {
    console.error("Failed to search clients:", error);
    sendError(res, 500, "Could not search clients");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Day-level editing + blocked dates
// ─────────────────────────────────────────────────────────────────────────────

// Statuses that must never be destroyed by regenerate/block operations.
const PROTECTED_SLOT_STATUSES = [
  SlotStatus.ASSIGNED,
  SlotStatus.COMPLETED,
  SlotStatus.CANCELED,
  SlotStatus.NO_SHOW,
];

const requireTrainer = async (
  req: Request,
  res: Response
): Promise<Trainer | null> => {
  const user = req.user;
  if (!user || user.role !== "trainer") {
    sendError(res, 403, "Trainer access required");
    return null;
  }
  const trainer = await getTrainerByUserId(user.id);
  if (!trainer) {
    sendError(res, 404, "Trainer profile not found");
    return null;
  }
  return trainer;
};

export const getBlockedDates = async (req: Request, res: Response): Promise<void> => {
  try {
    const trainer = await requireTrainer(req, res);
    if (!trainer) return;

    const where: any = { trainerId: trainer.id };
    const tz = resolveTimeZone(req.query.timeZone as string | undefined);
    const fromKey = req.query.from ? extractDateKey(String(req.query.from), tz) : null;
    const toKey = req.query.to ? extractDateKey(String(req.query.to), tz) : null;
    if (fromKey && toKey) {
      where.date = { [Op.between]: [fromKey, toKey] };
    }

    const rows = await TrainerBlockedDate.findAll({ where, order: [["date", "ASC"]] });
    sendSuccess(res, 200, "Blocked dates retrieved", rows);
  } catch (error) {
    console.error("Failed to get blocked dates:", error);
    sendError(res, 500, "Could not retrieve blocked dates");
  }
};

export const regenerateDay = async (
  req: Request<{ date: string }>,
  res: Response
): Promise<void> => {
  try {
    const trainer = await requireTrainer(req, res);
    if (!trainer) return;

    const dateKey = String(req.params.date);
    if (!isDateKey(dateKey)) {
      sendError(res, 400, "date must be YYYY-MM-DD");
      return;
    }

    const { startTime, endTime, slotDurationMin, timeZone } = req.body as {
      startTime?: string;
      endTime?: string;
      slotDurationMin?: number;
      timeZone?: string;
    };
    const tz = resolveTimeZone(timeZone);

    // Reject regeneration of a blocked day.
    const blocked = await TrainerBlockedDate.findOne({
      where: { trainerId: trainer.id, date: dateKey },
    });
    if (blocked) {
      sendError(res, 409, "Day is blocked; unblock before regenerating");
      return;
    }

    // Resolve the hours for this day: custom override or the saved template.
    let startMin: number;
    let endMin: number;
    let duration: number;
    let workingHourId: number | null = null;

    if (startTime && endTime) {
      startMin = parseTimeToMinutesTz(startTime);
      endMin = parseTimeToMinutesTz(endTime);
      duration = slotDurationMin && slotDurationMin > 0 ? slotDurationMin : 60;
    } else {
      const weekday = dateKeyWeekday(dateKey);
      const template = await TrainerWorkingHour.findOne({
        where: { trainerId: trainer.id, dayOfWeek: weekday, isActive: true },
      });
      if (!template) {
        sendError(res, 400, "No active template for this weekday; provide custom hours");
        return;
      }
      startMin = parseTimeToMinutesTz(template.startTime);
      endMin = parseTimeToMinutesTz(template.endTime);
      duration = slotDurationMin && slotDurationMin > 0 ? slotDurationMin : template.slotDurationMin;
      workingHourId = template.id;
    }

    if (endMin <= startMin) {
      sendError(res, 400, "endTime must be after startTime");
      return;
    }

    const { start, end } = zonedDayBoundsUtc(dateKey, tz);
    const existing = await TrainerScheduleSlot.findAll({
      where: { trainerId: trainer.id, startsAt: { [Op.between]: [start, end] } },
    });

    // Preserve protected slots; only replace AVAILABLE ones.
    const protectedSlots = existing.filter((s) => PROTECTED_SLOT_STATUSES.includes(s.status));
    const availableSlots = existing.filter((s) => s.status === SlotStatus.AVAILABLE);
    const occupiedEpochs = new Set(protectedSlots.map((s) => new Date(s.startsAt).getTime()));

    let removed = 0;
    for (const slot of availableSlots) {
      await slot.destroy();
      removed += 1;
    }

    const toCreate: TrainerScheduleSlotCreationAttributes[] = [];
    for (let minute = startMin; minute + duration <= endMin; minute += duration) {
      const startsAt = zonedWallClockToUtc(dateKey, minute, tz);
      if (occupiedEpochs.has(startsAt.getTime())) {
        continue; // a protected slot already occupies this time
      }
      occupiedEpochs.add(startsAt.getTime());
      toCreate.push({
        trainerId: trainer.id,
        workingHourId: workingHourId ?? undefined,
        startsAt,
        endsAt: zonedWallClockToUtc(dateKey, minute + duration, tz),
        status: SlotStatus.AVAILABLE,
      });
    }

    const created = toCreate.length ? await TrainerScheduleSlot.bulkCreate(toCreate) : [];

    sendSuccess(res, 200, "Day regenerated", {
      created: created.length,
      removed,
      preserved: protectedSlots.length,
      slots: created,
    });
  } catch (error) {
    console.error("Failed to regenerate day:", error);
    sendError(res, 500, "Could not regenerate day");
  }
};

export const createOneOffSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const trainer = await requireTrainer(req, res);
    if (!trainer) return;

    const { date, startTime, endTime, note, timeZone } = req.body as {
      date: string;
      startTime: string;
      endTime: string;
      note?: string;
      timeZone?: string;
    };

    if (!isDateKey(String(date))) {
      sendError(res, 400, "date must be YYYY-MM-DD");
      return;
    }
    const tz = resolveTimeZone(timeZone);
    const startMin = parseTimeToMinutesTz(startTime);
    const endMin = parseTimeToMinutesTz(endTime);
    if (endMin <= startMin) {
      sendError(res, 400, "endTime must be after startTime");
      return;
    }

    const blocked = await TrainerBlockedDate.findOne({
      where: { trainerId: trainer.id, date },
    });
    if (blocked) {
      sendError(res, 409, "Day is blocked; unblock before adding slots");
      return;
    }

    const startsAt = zonedWallClockToUtc(date, startMin, tz);
    const endsAt = zonedWallClockToUtc(date, endMin, tz);

    // Overlap guard: existing.start < new.end AND existing.end > new.start
    const overlap = await TrainerScheduleSlot.findOne({
      where: {
        trainerId: trainer.id,
        startsAt: { [Op.lt]: endsAt },
        endsAt: { [Op.gt]: startsAt },
      },
    });
    if (overlap) {
      sendError(res, 409, "Overlaps an existing slot");
      return;
    }

    const slot = await TrainerScheduleSlot.create({
      trainerId: trainer.id,
      startsAt,
      endsAt,
      note,
      status: SlotStatus.AVAILABLE,
    });

    sendSuccess(res, 201, "Slot created", { slot });
  } catch (error) {
    console.error("Failed to create one-off slot:", error);
    sendError(res, 500, "Could not create slot");
  }
};

export const deleteSlot = async (
  req: Request<{ slotId: string }>,
  res: Response
): Promise<void> => {
  try {
    const trainer = await requireTrainer(req, res);
    if (!trainer) return;

    const slotId = Number(req.params.slotId);
    if (!Number.isFinite(slotId) || slotId <= 0) {
      sendError(res, 400, "Invalid slot id");
      return;
    }

    const slot = await TrainerScheduleSlot.findOne({
      where: { id: slotId, trainerId: trainer.id },
    });
    if (!slot) {
      sendError(res, 404, "Slot not found");
      return;
    }

    if (slot.status !== SlotStatus.AVAILABLE) {
      sendError(res, 409, "Cannot delete a slot with an assignment; unassign first");
      return;
    }

    await slot.destroy();
    sendSuccess(res, 200, "Slot deleted", { slotId });
  } catch (error) {
    console.error("Failed to delete slot:", error);
    sendError(res, 500, "Could not delete slot");
  }
};

export const blockDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const trainer = await requireTrainer(req, res);
    if (!trainer) return;

    const { date, reason, timeZone } = req.body as {
      date: string;
      reason?: string;
      timeZone?: string;
    };
    if (!isDateKey(String(date))) {
      sendError(res, 400, "date must be YYYY-MM-DD");
      return;
    }
    const tz = resolveTimeZone(timeZone);
    const { start, end } = zonedDayBoundsUtc(date, tz);

    // Conflict check: do not block a day that has assigned/completed sessions.
    const conflictSlots = await TrainerScheduleSlot.findAll({
      where: {
        trainerId: trainer.id,
        startsAt: { [Op.between]: [start, end] },
        status: { [Op.in]: [SlotStatus.ASSIGNED, SlotStatus.COMPLETED] },
      },
      include: [{ model: User, as: "client", attributes: ["id", "firstName", "lastName"] }],
    });

    if (conflictSlots.length > 0) {
      res.status(409).json({
        success: false,
        message: "Day has assigned sessions; unassign them before blocking",
        conflicts: conflictSlots.map((s) => ({
          slotId: s.id,
          startsAt: s.startsAt,
          client: s.client
            ? { id: s.client.id, firstName: s.client.firstName, lastName: s.client.lastName }
            : null,
        })),
      });
      return;
    }

    // Clear remaining AVAILABLE slots that day.
    const removedAvailable = await TrainerScheduleSlot.destroy({
      where: {
        trainerId: trainer.id,
        startsAt: { [Op.between]: [start, end] },
        status: SlotStatus.AVAILABLE,
      },
    });

    const [blockedDate] = await TrainerBlockedDate.findOrCreate({
      where: { trainerId: trainer.id, date },
      defaults: { trainerId: trainer.id, date, reason: reason ?? null },
    });

    if (reason !== undefined && blockedDate.reason !== reason) {
      blockedDate.reason = reason ?? null;
      await blockedDate.save();
    }

    sendSuccess(res, 200, "Day blocked", { blockedDate, removedAvailable });
  } catch (error) {
    console.error("Failed to block date:", error);
    sendError(res, 500, "Could not block date");
  }
};

export const unblockDate = async (
  req: Request<{ date: string }>,
  res: Response
): Promise<void> => {
  try {
    const trainer = await requireTrainer(req, res);
    if (!trainer) return;

    const dateKey = String(req.params.date);
    if (!isDateKey(dateKey)) {
      sendError(res, 400, "date must be YYYY-MM-DD");
      return;
    }

    await TrainerBlockedDate.destroy({
      where: { trainerId: trainer.id, date: dateKey },
    });

    // Note: unblocking does NOT recreate slots — the trainer must regenerate.
    sendSuccess(res, 200, "Day unblocked", { date: dateKey });
  } catch (error) {
    console.error("Failed to unblock date:", error);
    sendError(res, 500, "Could not unblock date");
  }
};
