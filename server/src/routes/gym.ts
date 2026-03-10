import express from "express";
import {
  getAllGyms,
  getGymById,
  getMyGyms,
  joinGym,
  setGymAvailability,
  leaveGym,
  createGym,
} from "../controllers/gym";
import { authenticate } from "../middleware/auth";

const router = express.Router();

// Public routes (no auth needed to view gyms on map)
router.get("/", getAllGyms);
router.get("/my-gyms", authenticate, getMyGyms);  // must come BEFORE /:gymId
router.get("/:gymId", getGymById);

// Trainer routes
router.post("/:gymId/join", authenticate, joinGym);
router.patch("/:gymId/availability", authenticate, setGymAvailability);
router.delete("/:gymId/leave", authenticate, leaveGym);

// Admin route — in production add an isAdmin middleware here
router.post("/", authenticate, createGym);

export default router;