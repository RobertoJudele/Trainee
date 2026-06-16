import express from "express";
import {
	updateProfile,
	deleteProfile,
	uploadProfilePicture,
	deleteProfilePicture,
} from "../controllers/user";
import { authenticate } from "../middleware/auth";
import {
	handleValidationErrors,
	updateProfileValidation,
} from "../middleware/validation";

const router = express.Router();

router.use(authenticate);

router.put("/", updateProfileValidation, handleValidationErrors, updateProfile);
router.delete("/", deleteProfile);

// Profile picture for any authenticated user. `uploadProfilePicture` is an
// [multer, handler] tuple — Express flattens the array of handlers.
router.post("/profile-picture", uploadProfilePicture);
router.delete("/profile-picture", deleteProfilePicture);

export default router;
