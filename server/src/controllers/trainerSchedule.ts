import crypto from "crypto";
import { Request, Response } from "express";
import { Op } from "sequelize";
import { ClientCheckInCode } from "../models/clientCheckInCode";
import { Trainer } from "../models/trainer";
import { TrainerScheduleSlot } from "../models/trainerScheduleSlot";
import { TrainerWorkingHour } from "../models/trainerWorkingHour";
import { User } from "../models/user";
import { SlotStatus } from "../types/schedule";
import { sendError, sendSuccess } from "../utils/response";

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

const hashCheckInCode = (code: string) => {
  const secret = process.env.CHECKIN_CODE_SECRET || "trainer-checkin-secret";
  return crypto.createHash("sha256").update(`${code}:${secret}`).digest("hex");
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

    const { fromDate, toDate } = req.body as { fromDate: string; toDate: string };
    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      sendError(res, 400, "Invalid date range");
      return;
    }

    const templates = await TrainerWorkingHour.findAll({
      where: { trainerId: trainer.id, isActive: true },
    });

    if (templates.length === 0) {
      sendError(res, 400, "No active working-hour templates found");
      return;
    }

    const created: TrainerScheduleSlot[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    while (cursor <= to) {
      const day = cursor.getDay();
      const dayTemplates = templates.filter((t) => t.dayOfWeek === day);

      for (const template of dayTemplates) {
        const startMin = parseTimeToMinutes(template.startTime);
        const endMin = parseTimeToMinutes(template.endTime);
        const duration = template.slotDurationMin;

        for (let minute = startMin; minute + duration <= endMin; minute += duration) {
          const startsAt = toDateAtMinutes(cursor, minute);
          const endsAt = toDateAtMinutes(cursor, minute + duration);

          const exists = await TrainerScheduleSlot.findOne({
            where: {
              trainerId: trainer.id,
              startsAt,
            },
          });

          if (!exists) {
            const slot = await TrainerScheduleSlot.create({
              trainerId: trainer.id,
              workingHourId: template.id,
              startsAt,
              endsAt,
              status: SlotStatus.AVAILABLE,
            });
            created.push(slot);
          }
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

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
