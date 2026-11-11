import { HttpError } from "./http.js";

const MEDIA_KEY_PATTERN =
  /^media\/([1-9]\d{0,9})\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(png|jpg)$/;

export interface MediaKey {
  sessionId: number;
  extension: "png" | "jpg";
}

export function parseMediaKey(key: unknown): MediaKey {
  if (typeof key !== "string") {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }

  const match = MEDIA_KEY_PATTERN.exec(key);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }

  const sessionId = Number(match[1]);
  if (!Number.isSafeInteger(sessionId) || sessionId < 1) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }

  return {
    sessionId,
    extension: match[3] as "png" | "jpg",
  };
}
