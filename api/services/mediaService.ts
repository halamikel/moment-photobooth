import { stat } from "node:fs/promises";
import type { Response } from "express";
import type { MediaSummary } from "../../shared/contracts.js";
import type { MediaRecord } from "../db/repository.js";
import { HttpError } from "../utils/http.js";
import { resolveStoredFilePath } from "../utils/files.js";

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
  const filePath = resolveStoredFilePath(media.fileName);

  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }

  if (!fileStats.isFile() || fileStats.size !== media.sizeBytes) {
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

  await new Promise<void>((resolve, reject) => {
    res.sendFile(
      filePath,
      {
        cacheControl: false,
        dotfiles: "deny",
        acceptRanges: false,
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
    );
  });
}
