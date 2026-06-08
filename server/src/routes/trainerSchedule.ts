import express from "express";
import { authenticate } from "../middleware/auth";
import {
  assignSlotByCodeId,
  assignSlotByClientCode,
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
  trainerCheckInSlot,
  unassignClientFromSlot,
  unblockDate,
  upsertWorkingHour,
} from "../controllers/trainerSchedule";
import {
  assignClientToSlotValidation,
  assignSlotByCodeIdValidation,
  assignSlotByCodeValidation,
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
  trainerCheckInValidation,
  trainerSlotsQueryValidation,
  unblockDateValidation,
  upsertWorkingHourValidation,
} from "../middleware/validation";

const router = express.Router();

router.use(authenticate);

router.post(
  "/working-hours",
  upsertWorkingHourValidation,
  handleValidationErrors,
  upsertWorkingHour
);
router.get("/working-hours", getWorkingHours);
router.post(
  "/generate-slots",
  generateSlotsValidation,
  handleValidationErrors,
  generateSlots
);
router.get("/slots", trainerSlotsQueryValidation, handleValidationErrors, getTrainerSlots);

// Day-level editing + blocked dates
router.get("/blocked-dates", blockedDatesQueryValidation, handleValidationErrors, getBlockedDates);
router.post("/blocked-dates", blockDateValidation, handleValidationErrors, blockDate);
router.delete("/blocked-dates/:date", unblockDateValidation, handleValidationErrors, unblockDate);
router.post("/days/:date/regenerate", regenerateDayValidation, handleValidationErrors, regenerateDay);
router.post("/slots", createOneOffSlotValidation, handleValidationErrors, createOneOffSlot);
router.delete("/slots/:slotId", slotIdParamValidation, handleValidationErrors, deleteSlot);
router.get(
  "/clients/search",
  searchClientsQueryValidation,
  handleValidationErrors,
  searchClientsForTrainer
);
router.get("/client-codes/pending", getPendingClientCodes);
router.post(
  "/client-codes/resolve",
  resolveClientCodeValidation,
  handleValidationErrors,
  resolveClientCode
);
router.post(
  "/slots/:slotId/assign-client",
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
router.post(
  "/slots/:slotId/assign-by-code",
  assignSlotByCodeValidation,
  handleValidationErrors,
  assignSlotByClientCode
);
router.post(
  "/slots/:slotId/assign-by-code-id",
  assignSlotByCodeIdValidation,
  handleValidationErrors,
  assignSlotByCodeId
);
router.post(
  "/slots/:slotId/check-in",
  trainerCheckInValidation,
  handleValidationErrors,
  trainerCheckInSlot
);
router.post("/my-schedule/generate-check-in-code", generateClientCheckInCode);
router.post(
  "/my-schedule/:slotId/generate-check-in-code",
  slotIdParamValidation,
  handleValidationErrors,
  generateClientCheckInCode
);
router.get(
  "/my-schedule",
  clientScheduleQueryValidation,
  handleValidationErrors,
  getClientSchedule
);

export default router;
