import { Router } from "express";
import {
  createSessionHandler,
  createShareHandler,
  finalizeSessionHandler,
  getOwnerMediaHandler,
  getSessionHandler,
} from "../controllers/sessionController.js";
import { requireSessionAccess } from "../middleware/auth.js";
import {
  downloadLimiter,
  sessionCreateLimiter,
  shareCreateLimiter,
  uploadLimiter,
} from "../middleware/rateLimit.js";
import { uploadFinalize } from "../middleware/upload.js";
import { asyncHandler } from "../utils/http.js";

export const sessionRoutes = Router();

sessionRoutes.post("/", sessionCreateLimiter, asyncHandler(createSessionHandler));
sessionRoutes.get("/:id", requireSessionAccess, asyncHandler(getSessionHandler));
sessionRoutes.post(
  "/:id/finalize",
  uploadLimiter,
  requireSessionAccess,
  uploadFinalize,
  asyncHandler(finalizeSessionHandler),
);
sessionRoutes.post(
  "/:id/share",
  shareCreateLimiter,
  requireSessionAccess,
  asyncHandler(createShareHandler),
);
sessionRoutes.get(
  "/:id/media/:mediaId",
  downloadLimiter,
  requireSessionAccess,
  asyncHandler(getOwnerMediaHandler),
);
