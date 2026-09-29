// The HTTP edge of the scheduling feature. Every rule, every query and every
// transaction now lives behind services/schedule; what is left here is the
// translation between an Express request and that service, plus one place
// where a ScheduleError becomes a status code.
//
// This file was 1173 lines. The eight-line "check the role, look up the
// trainer, 404" preamble appeared at the top of eight handlers; the
// slot-walking loop appeared three times with three different overlap rules;
// no handler opened a transaction. None of that is expressible from here any
// more - the service takes an Actor, not a Request, and hands back values.
import { Request, Response } from "express";
import { ScheduleError, scheduleService } from "../services/schedule";
import type { Actor, SlotView, WorkingHourView } from "../services/schedule";
import type { BlockedDayView, ClientRecord } from "../services/schedule";
import { sendError, sendSuccess } from "../utils/response";

// ─────────────────────────────────────────────────────────────────────────────
// Edge plumbing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `authenticate` runs before every route in this router, so req.user is set -
 * but the type does not say so. A handler reaching the service without an
 * actor is a wiring bug, not a client error, hence 401 rather than a silent
 * anonymous call.
 */
const actorOf = (req: Request): Actor | null => {
  const user = req.user;
  return user ? { userId: user.id, role: String(user.role) } : null;
};

/**
 * The single error boundary. A ScheduleError already knows its status, so the
 * status/message pairing lives with the rule that produced it instead of being
 * re-decided at each of ~40 call sites - which is how the same condition ended
 * up answering 403 in one handler and 404 in another.
 */
const handle = (
  label: string,
  fallbackMessage: string,
  work: (actor: Actor, req: Request, res: Response) => Promise<void>
) => async (req: Request, res: Response): Promise<void> => {
  const actor = actorOf(req);
  if (!actor) {
    sendError(res, 401, "Authentication required");
    return;
  }
  try {
    await work(actor, req, res);
  } catch (error) {
    if (error instanceof ScheduleError) {
      if (error.details) {
        // blockDate's conflict payload is a pre-existing non-standard shape:
        // the conflicts sit beside `message`, not inside `data`.
        res.status(error.status).json({
          success: false,
          message: error.message,
          ...error.details,
        });
        return;
      }
      sendError(res, error.status, error.message);
      return;
    }
    console.error(`${label} failed:`, error);
    sendError(res, 500, fallbackMessage);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Wire shapes
// ─────────────────────────────────────────────────────────────────────────────
//
// `status` is a denormalisation of "does this slot have a client". The domain
// reasons about the fact; the column and the JSON field are derived here, at
// the one boundary that still has to speak the old vocabulary.

const slotJson = (slot: SlotView) => ({
  id: slot.id,
  trainerId: slot.trainerId,
  clientId: slot.clientId,
  workingHourId: slot.workingHourId,
  startsAt: slot.startsAt,
  endsAt: slot.endsAt,
  status: slot.clientId == null ? "available" : "assigned",
  note: slot.note,
  ...(slot.client === undefined ? {} : { client: slot.client }),
});

const workingHourJson = (row: WorkingHourView) => ({ ...row });

const blockedDayJson = (row: BlockedDayView) => ({ ...row });

const publicClientJson = (client: ClientRecord) => ({
  id: client.id,
  email: client.email,
  firstName: client.firstName,
  lastName: client.lastName,
});

// ─────────────────────────────────────────────────────────────────────────────
// Working hours
// ─────────────────────────────────────────────────────────────────────────────

export const upsertWorkingHour = handle(
  "Upsert working hour",
  "Could not save working hour",
  async (actor, req, res) => {
    const { row, created } = await scheduleService().saveWorkingHour(actor, req.body);
    sendSuccess(
      res,
      created ? 201 : 200,
      created ? "Working hour created" : "Working hour updated",
      workingHourJson(row)
    );
  }
);

export const getWorkingHours = handle(
  "Get working hours",
  "Could not retrieve working hours",
  async (actor, _req, res) => {
    const rows = await scheduleService().listWorkingHours(actor);
    sendSuccess(res, 200, "Working hours retrieved", rows.map(workingHourJson));
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Supply: generating and editing slots
// ─────────────────────────────────────────────────────────────────────────────

export const generateSlots = handle(
  "Generate slots",
  "Could not generate slots",
  async (actor, req, res) => {
    const result = await scheduleService().generate(actor, req.body);
    sendSuccess(res, 201, "Slots generated", {
      count: result.created.length,
      removed: result.removed,
      slots: result.created.map(slotJson),
    });
  }
);

export const regenerateDay = handle(
  "Regenerate day",
  "Could not regenerate day",
  async (actor, req, res) => {
    const result = await scheduleService().regenerateDay(actor, req.params.date, req.body);
    sendSuccess(res, 200, "Day regenerated", {
      created: result.created.length,
      removed: result.removed,
      preserved: result.preserved,
      slots: result.created.map(slotJson),
    });
  }
);

export const createOneOffSlot = handle(
  "Create one-off slot",
  "Could not create slot",
  async (actor, req, res) => {
    const slot = await scheduleService().addSlot(actor, req.body);
    sendSuccess(res, 201, "Slot created", { slot: slotJson(slot) });
  }
);

export const deleteSlot = handle("Delete slot", "Could not delete slot", async (actor, req, res) => {
  const slotId = await scheduleService().deleteSlot(actor, req.params.slotId);
  sendSuccess(res, 200, "Slot deleted", { slotId });
});

export const getTrainerSlots = handle(
  "Get trainer slots",
  "Could not retrieve trainer slots",
  async (actor, req, res) => {
    const slots = await scheduleService().listTrainerSlots(actor, req.query);
    sendSuccess(res, 200, "Trainer slots retrieved", slots.map(slotJson));
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Demand: booking and releasing
// ─────────────────────────────────────────────────────────────────────────────

export const assignClientToSlot = handle(
  "Assign client to slot",
  "Could not assign client to slot",
  async (actor, req, res) => {
    const result = await scheduleService().book(actor, req.params.slotId, req.body);
    sendSuccess(res, 200, "Client assigned to slot", {
      slot: slotJson(result.slot),
      // Pack bookkeeping is committed with the booking now, but it still must
      // not fail it; when its savepoint rolls back the caller is told rather
      // than the failure vanishing into a server log.
      ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    });
  }
);

export const unassignClientFromSlot = handle(
  "Unassign client from slot",
  "Could not unassign client from slot",
  async (actor, req, res) => {
    const result = await scheduleService().release(actor, req.params.slotId);
    sendSuccess(
      res,
      200,
      result.alreadyFree ? "Slot is already available" : "Client unassigned from slot",
      {
        slot: slotJson(result.slot),
        ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
      }
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Blocked dates
// ─────────────────────────────────────────────────────────────────────────────

export const getBlockedDates = handle(
  "Get blocked dates",
  "Could not retrieve blocked dates",
  async (actor, req, res) => {
    const rows = await scheduleService().listBlockedDays(actor, req.query);
    sendSuccess(res, 200, "Blocked dates retrieved", rows.map(blockedDayJson));
  }
);

export const blockDate = handle("Block date", "Could not block date", async (actor, req, res) => {
  const { blockedDate, removedAvailable } = await scheduleService().blockDay(actor, req.body);
  sendSuccess(res, 200, "Day blocked", {
    blockedDate: blockedDayJson(blockedDate),
    removedAvailable,
  });
});

export const unblockDate = handle(
  "Unblock date",
  "Could not unblock date",
  async (actor, req, res) => {
    const date = await scheduleService().unblockDay(actor, req.params.date);
    sendSuccess(res, 200, "Day unblocked", { date });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Clients: search, and the assign-code handshake
// ─────────────────────────────────────────────────────────────────────────────

export const searchClientsForTrainer = handle(
  "Search clients",
  "Could not search clients",
  async (actor, req, res) => {
    const clients = await scheduleService().findClients(actor, req.query.q);
    sendSuccess(res, 200, "Clients found", clients.map(publicClientJson));
  }
);

export const generateClientCheckInCode = handle(
  "Generate client check-in code",
  "Could not generate check-in code",
  async (actor, _req, res) => {
    const { code, expiresAt } = await scheduleService().issueAssignCode(actor);
    sendSuccess(res, 200, "Check-in code generated", { code, expiresAt });
  }
);

export const getPendingClientCodes = handle(
  "Get pending client codes",
  "Could not retrieve pending client codes",
  async (actor, _req, res) => {
    const records = await scheduleService().listPendingAssignCodes(actor);
    sendSuccess(
      res,
      200,
      "Pending client codes retrieved",
      records.map((record) => ({
        checkInCodeId: record.id,
        expiresAt: record.expiresAt,
        client: publicClientJson(record.client),
      }))
    );
  }
);

export const resolveClientCode = handle(
  "Resolve client code",
  "Could not resolve client code",
  async (actor, req, res) => {
    const resolved = await scheduleService().resolveAssignCode(actor, req.body?.code);
    sendSuccess(res, 200, "Client code resolved", {
      checkInCodeId: resolved.assignCodeId,
      expiresAt: resolved.expiresAt,
      client: publicClientJson(resolved.client),
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// The client's own schedule
// ─────────────────────────────────────────────────────────────────────────────

export const getClientSchedule = handle(
  "Get client schedule",
  "Could not retrieve client schedule",
  async (actor, req, res) => {
    const slots = await scheduleService().listClientSchedule(actor, req.query);
    sendSuccess(res, 200, "Client schedule retrieved", slots.map(slotJson));
  }
);
