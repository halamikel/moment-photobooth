import { FRAME_COUNTS, type MediaKind } from "../../shared/contracts.js";
import { config } from "../config.js";
import { inTransaction } from "../db/database.js";
import {
  insertMedia,
  listMediaBySession,
  markSessionFinalized,
  type MediaRecord,
  type SessionRecord,
} from "../db/repository.js";
import { parseMediaKey } from "../utils/files.js";
import { HttpError } from "../utils/http.js";
import { isAllowedImageMimeType } from "../utils/image.js";
import { deleteStoredMedia, getStoredMediaMetadata } from "./storageService.js";

export interface FinalizeInput {
  strip: string;
  frames: string[];
}

interface PreparedFile {
  kind: MediaKind;
  position: number;
  key: string;
  mimeType: "image/png" | "image/jpeg";
  sizeBytes: number;
}

function extensionMatchesMimeType(
  extension: "png" | "jpg",
  mimeType: "image/png" | "image/jpeg",
): boolean {
  return extension === (mimeType === "image/png" ? "png" : "jpg");
}

async function prepareFile(
  key: string,
  sessionId: number,
  kind: MediaKind,
  position: number,
): Promise<PreparedFile> {
  const parsed = parseMediaKey(key);
  if (parsed.sessionId !== sessionId) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }

  const metadata = await getStoredMediaMetadata(key);
  if (
    !metadata.contentType ||
    !isAllowedImageMimeType(metadata.contentType) ||
    !extensionMatchesMimeType(parsed.extension, metadata.contentType)
  ) {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Only PNG and JPEG images are accepted.",
    );
  }

  if (metadata.sizeBytes <= 0 || metadata.sizeBytes > config.maxUploadBytes) {
    throw new HttpError(413, "INVALID_UPLOAD_SIZE", "Each image must be 10MB or smaller.");
  }

  return {
    kind,
    position,
    key,
    mimeType: metadata.contentType,
    sizeBytes: metadata.sizeBytes,
  };
}

export async function finalizeSessionMedia(
  session: SessionRecord,
  input: FinalizeInput,
): Promise<{ finalizedAt: string; media: MediaRecord[] }> {
  if (session.finalizedAt) {
    throw new HttpError(409, "ALREADY_FINALIZED", "This photo session has already been finalized.");
  }

  const expectedFrames = FRAME_COUNTS[session.layout];
  if (input.frames.length !== expectedFrames) {
    throw new HttpError(
      400,
      "MISSING_FRAME",
      `Exactly ${expectedFrames} frame image(s) are required for this layout.`,
    );
  }

  const ownedKeys: string[] = [];
  try {
    const prepared: PreparedFile[] = [];

    const strip = await prepareFile(input.strip, session.id, "strip", 0);
    ownedKeys.push(strip.key);
    prepared.push(strip);

    for (let index = 0; index < expectedFrames; index += 1) {
      const key = input.frames[index];
      if (typeof key !== "string") {
        throw new HttpError(400, "MISSING_FRAME", "One of the photo frames is missing.");
      }
      const frame = await prepareFile(key, session.id, "frame", index);
      ownedKeys.push(frame.key);
      prepared.push(frame);
    }

    const finalizedAt = new Date().toISOString();
    const media = await inTransaction(async () => {
      const updated = await markSessionFinalized(session.id, finalizedAt);
      if (!updated) {
        throw new HttpError(
          409,
          "ALREADY_FINALIZED",
          "This photo session has already been finalized.",
        );
      }

      for (const item of prepared) {
        await insertMedia({
          sessionId: session.id,
          kind: item.kind,
          position: item.position,
          fileName: item.key,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          createdAt: finalizedAt,
        });
      }

      return listMediaBySession(session.id);
    });

    return { finalizedAt, media };
  } catch (error) {
    await deleteStoredMedia(ownedKeys);
    throw error;
  }
}
