import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Response } from "express";
import type { MediaSummary } from "../../shared/contracts.js";
import type { MediaRecord } from "../db/repository.js";
import { HttpError } from "../utils/http.js";
import { openStoredMedia } from "./storageService.js";

function extensionFor(fileName: string): string {
  return fileName.endsWith(".png") ? "png" : "jpg";
}

export function toOwnerMediaSummary(media: MediaRecord, sessionId: number): MediaSummary {
  const base = `/api/sessions/${sessionId}/media/${media.id}`;
  return {
    id: media.id,
    kind: media.kind,
    position: media.position,
    url: base,
    downloadUrl: `${base}?download=1`,
  };
}

export function toShareMediaSummary(media: MediaRecord, shareToken: string): MediaSummary {
  const base = `/api/shares/${encodeURIComponent(shareToken)}/media/${media.id}`;
  return {
    id: media.id,
    kind: media.kind,
    position: media.position,
    url: base,
    downloadUrl: `${base}?download=1`,
  };
}

export async function sendStoredMedia(
  res: Response,
  media: MediaRecord,
  download: boolean,
): Promise<void> {
  const result = await openStoredMedia(media.fileName);

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }

  if (result.blob.size !== null && result.blob.size !== media.sizeBytes) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }

  const extension = extensionFor(media.fileName);
  const disposition = download ? "attachment" : "inline";
  res.setHeader("Content-Type", media.mimeType);
  res.setHeader("Content-Length", String(media.sizeBytes));
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename="moment-${media.kind}-${media.id}.${extension}"`,
  );
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");

  const nodeStream = Readable.fromWeb(
    result.stream as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
  );
  await pipeline(nodeStream, res);
}
