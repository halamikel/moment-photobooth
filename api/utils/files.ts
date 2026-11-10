import { randomUUID } from "node:crypto";
import path from "node:path";
import { config } from "../config.js";
import { HttpError } from "./http.js";

const STORED_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg)$/;

export function createStoredFileName(extension: "png" | "jpg"): string {
  return `${randomUUID()}.${extension}`;
}

export function resolveStoredFilePath(fileName: string): string {
  if (!STORED_FILE_PATTERN.test(fileName)) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }

  const uploadRoot = path.resolve(config.uploadDir);
  const resolved = path.resolve(uploadRoot, fileName);
  if (!resolved.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }

  return resolved;
}
