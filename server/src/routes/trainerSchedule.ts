import express from "express";
import { authenticate } from "../middleware/auth";
import {
  assignSlotByCodeId,
  assignSlotByClientCode,
  assignClientToSlot,
  generateClientCheckInCode,
  generateSlots,
  getPendingClientCodes,
  getClientSchedule,
  getTrainerSlots,
  getWorkingHours,
  resolveClientCode,
  searchClientsForTrainer,
  trainerCheckInSlot,
  unassignClientFromSlot,
  upsertWorkingHour,
} from "../controllers/trainerSchedule";

const router = express.Router();

router.use(authenticate);

router.post("/working-hours", upsertWorkingHour);
router.get("/working-hours", getWorkingHours);
router.post("/generate-slots", generateSlots);
router.get("/slots", getTrainerSlots);
router.get("/clients/search", searchClientsForTrainer);
router.get("/client-codes/pending", getPendingClientCodes);
router.post("/client-codes/resolve", resolveClientCode);
router.post("/slots/:slotId/assign-client", assignClientToSlot);
router.post("/slots/:slotId/unassign-client", unassignClientFromSlot);
router.post("/slots/:slotId/assign-by-code", assignSlotByClientCode);
router.post("/slots/:slotId/assign-by-code-id", assignSlotByCodeId);
router.post("/slots/:slotId/check-in", trainerCheckInSlot);
router.post("/my-schedule/generate-check-in-code", generateClientCheckInCode);
router.post("/my-schedule/:slotId/generate-check-in-code", generateClientCheckInCode);
router.get("/my-schedule", getClientSchedule);

export default router;
