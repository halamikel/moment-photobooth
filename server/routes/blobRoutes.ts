import { Router } from "express";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { config } from "../config.js";
import { authenticateSessionToken, bearerTokenFromHeader } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { parseMediaKey } from "../utils/files.js";
import { ALLOWED_IMAGE_MIME_TYPES } from "../utils/image.js";

export const blobRoutes = Router();

blobRoutes.post(
  "/blob-upload",
  asyncHandler(async (req, res) => {
    const body = req.body as HandleUploadBody | undefined;
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "INVALID_UPLOAD_REQUEST", "The upload request is invalid.");
    }

    const response = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const token = bearerTokenFromHeader(req.get("authorization"));
        if (!token) {
          throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
        }

        const parsed = parseMediaKey(pathname);
        await authenticateSessionToken(token, parsed.sessionId);

        return {
          allowedContentTypes: [...ALLOWED_IMAGE_MIME_TYPES],
          maximumSizeInBytes: config.maxUploadBytes,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });

    res.json(response);
  }),
);
