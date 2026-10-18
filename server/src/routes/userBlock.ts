import express, { RequestHandler } from "express";
import { blockUser, getBlockedUsers, unblockUser } from "../controllers/userBlock";
import { authenticate } from "../middleware/auth";
import { sendSuccess } from "../utils/response";

const router = express.Router();

// A logged-out visitor has no blocks. Answering 401 made app builds from before
// the apiSlice.ts fix reset their whole cache on the trainer profile, re-run this
// query, get another 401, and loop — re-fetching /trainer/:id until the rate
// limit answered 429. A request carrying a token still goes through
// authenticate, so an expired session keeps getting the 401 the app refreshes on.
const emptyListWhenLoggedOut: RequestHandler = (req, res, next) => {
  if (req.header("Authorization")) return next();
  sendSuccess(res, 200, "Blocked users retrieved", []);
};

router.get("/", emptyListWhenLoggedOut, authenticate, getBlockedUsers);

router.use(authenticate);

router.post("/", blockUser);
router.delete("/:userId", unblockUser);

export default router;
