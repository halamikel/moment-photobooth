import { Router } from "express";
import {
  getShareHandler,
  getShareMediaHandler,
} from "../controllers/shareController.js";
import { downloadLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../utils/http.js";

export const shareRoutes = Router();

shareRoutes.get("/:token", downloadLimiter, asyncHandler(getShareHandler));
shareRoutes.get(
  "/:token/media/:mediaId",
  downloadLimiter,
  asyncHandler(getShareMediaHandler),
);
