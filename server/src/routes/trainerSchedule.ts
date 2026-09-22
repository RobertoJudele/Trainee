import express from "express";
import { authenticate } from "../middleware/auth";
import { subscription } from "../middleware/subscription";
import {
  assignClientToSlot,
  blockDate,
  createOneOffSlot,
  deleteSlot,
  generateClientCheckInCode,
  generateSlots,
  getBlockedDates,
  getPendingClientCodes,
  getClientSchedule,
  getTrainerSlots,
  getWorkingHours,
  regenerateDay,
  resolveClientCode,
  searchClientsForTrainer,
  unassignClientFromSlot,
  unblockDate,
  upsertWorkingHour,
} from "../controllers/trainerSchedule";
import {
  assignClientToSlotValidation,
  blockDateValidation,
  blockedDatesQueryValidation,
  clientScheduleQueryValidation,
  createOneOffSlotValidation,
  generateSlotsValidation,
  handleValidationErrors,
  regenerateDayValidation,
  resolveClientCodeValidation,
  searchClientsQueryValidation,
  slotIdParamValidation,
  trainerSlotsQueryValidation,
  unblockDateValidation,
  upsertWorkingHourValidation,
} from "../middleware/validation";

const router = express.Router();

router.use(authenticate);

// `subscription` is applied per-route, never with router.use, for two reasons.
// The /my-schedule/* endpoints below belong to CLIENTS, and the middleware
// resolves a trainer's billing state - it would answer "Trainer profile not
// found" and break every client. And reads stay open so the schedule screens
// still load: an unsubscribed trainer sees their schedule and is prompted to
// subscribe, rather than meeting an error where the page should be.
//
// The rule for writes: gate what creates value, never gate withdrawal. Deleting
// a slot, unassigning a client and unblocking a date stay open so nobody is
// locked out of undoing their own data.

router.post(
  "/working-hours",
  subscription,
  upsertWorkingHourValidation,
  handleValidationErrors,
  upsertWorkingHour
);
router.get("/working-hours", getWorkingHours);
router.post(
  "/generate-slots",
  subscription,
  generateSlotsValidation,
  handleValidationErrors,
  generateSlots
);
router.get("/slots", trainerSlotsQueryValidation, handleValidationErrors, getTrainerSlots);

// Day-level editing + blocked dates
router.get("/blocked-dates", blockedDatesQueryValidation, handleValidationErrors, getBlockedDates);
router.post("/blocked-dates", subscription, blockDateValidation, handleValidationErrors, blockDate);
router.delete("/blocked-dates/:date", unblockDateValidation, handleValidationErrors, unblockDate);
router.post("/days/:date/regenerate", subscription, regenerateDayValidation, handleValidationErrors, regenerateDay);
router.post("/slots", subscription, createOneOffSlotValidation, handleValidationErrors, createOneOffSlot);
router.delete("/slots/:slotId", slotIdParamValidation, handleValidationErrors, deleteSlot);
router.get(
  "/clients/search",
  searchClientsQueryValidation,
  handleValidationErrors,
  searchClientsForTrainer
);
// Only codes issued by clients already on this trainer's roster are listed here
// (see getPendingClientCodes) - a brand-new client is onboarded by typing their
// code, not by browsing this list. See the cross-tenant fix note in the controller.
router.get("/client-codes/pending", getPendingClientCodes);
router.post(
  "/client-codes/resolve",
  subscription,
  resolveClientCodeValidation,
  handleValidationErrors,
  resolveClientCode
);
router.post(
  "/slots/:slotId/assign-client",
  subscription,
  assignClientToSlotValidation,
  handleValidationErrors,
  assignClientToSlot
);
router.post(
  "/slots/:slotId/unassign-client",
  slotIdParamValidation,
  handleValidationErrors,
  unassignClientFromSlot
);
router.post("/my-schedule/generate-check-in-code", generateClientCheckInCode);
router.get(
  "/my-schedule",
  clientScheduleQueryValidation,
  handleValidationErrors,
  getClientSchedule
);

export default router;
