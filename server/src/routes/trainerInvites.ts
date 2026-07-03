import Express from "express";
import { authenticate } from "../middleware/auth";
import {
  getMyInviteCode,
  redeemInvite,
  getMyConnectedClients,
  getMyTrainers,
} from "../controllers/trainerInvites";
import {
  redeemInviteValidation,
  handleValidationErrors,
} from "../middleware/validation";
import { inviteRedeemRateLimit } from "../middleware/rateLimitProfiles";

const router = Express.Router();

router.use(authenticate);

router.get("/mine", getMyInviteCode);
router.get("/clients", getMyConnectedClients);
router.get("/my-trainers", getMyTrainers);
router.post(
  "/redeem",
  inviteRedeemRateLimit,
  redeemInviteValidation,
  handleValidationErrors,
  redeemInvite
);

export default router;
