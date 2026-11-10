import multer from "multer";
import { config } from "../config.js";
import { HttpError } from "../utils/http.js";
import { isAllowedImageMimeType } from "../utils/image.js";

export const uploadFinalize = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadBytes,
    files: 5,
    fields: 4,
    parts: 10,
    fieldSize: 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedImageMimeType(file.mimetype)) {
      callback(
        new HttpError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Only PNG and JPEG images are accepted.",
        ),
      );
      return;
    }
    callback(null, true);
  },
}).fields([
  { name: "strip", maxCount: 1 },
  { name: "frame_0", maxCount: 1 },
  { name: "frame_1", maxCount: 1 },
  { name: "frame_2", maxCount: 1 },
  { name: "frame_3", maxCount: 1 },
]);
