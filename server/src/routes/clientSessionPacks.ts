import Express from "express";
import { authenticate } from "../middleware/auth";
import {
  createClientPack,
  getClientPacks,
  updateClientPack,
  deleteClientPack,
  getMyPacks,
} from "../controllers/clientSessionPacks";
import {
  createClientPackValidation,
  updateClientPackValidation,
  handleValidationErrors,
} from "../middleware/validation";

const router = Express.Router();

router.use(authenticate);

router.get("/mine", getMyPacks);
router.get("/", getClientPacks);
router.post(
  "/",
  createClientPackValidation,
  handleValidationErrors,
  createClientPack
);
router.put(
  "/:id",
  updateClientPackValidation,
  handleValidationErrors,
  updateClientPack
);
router.delete("/:id", deleteClientPack);

export default router;
