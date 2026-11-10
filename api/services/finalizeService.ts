import { unlink, writeFile } from "node:fs/promises";
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
import { createStoredFileName, resolveStoredFilePath } from "../utils/files.js";
import { HttpError } from "../utils/http.js";
import {
  extensionForMimeType,
  isAllowedImageMimeType,
  sniffImageMimeType,
} from "../utils/image.js";

type MulterFileMap = Record<string, Express.Multer.File[]>;

interface PreparedFile {
  kind: MediaKind;
  position: number;
  file: Express.Multer.File;
  mimeType: "image/png" | "image/jpeg";
  storedFileName: string;
}

function filesFor(files: MulterFileMap, fieldName: string): Express.Multer.File[] {
  return files[fieldName] ?? [];
}

function prepareFile(
  file: Express.Multer.File,
  kind: MediaKind,
  position: number,
): PreparedFile {
  if (!file.size || file.size > config.maxUploadBytes || file.buffer.length !== file.size) {
    throw new HttpError(413, "INVALID_UPLOAD_SIZE", "Each image must be 10MB or smaller.");
  }

  if (!isAllowedImageMimeType(file.mimetype)) {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Only PNG and JPEG images are accepted.",
    );
  }

  const detectedMimeType = sniffImageMimeType(file.buffer);
  if (!detectedMimeType || detectedMimeType !== file.mimetype) {
    throw new HttpError(
      415,
      "MEDIA_SIGNATURE_MISMATCH",
      "The uploaded file is not a valid PNG or JPEG image.",
    );
  }

  const extension = extensionForMimeType(detectedMimeType);

  return {
    kind,
    position,
    file,
    mimeType: detectedMimeType,
    storedFileName: createStoredFileName(extension),
  };
}

async function removeQuietly(fileNames: string[]): Promise<void> {
  await Promise.all(
    fileNames.map(async (fileName) => {
      try {
        await unlink(resolveStoredFilePath(fileName));
      } catch {
        // Cleanup is best effort.
      }
    }),
  );
}

export async function finalizeSessionMedia(
  session: SessionRecord,
  files: MulterFileMap | undefined,
): Promise<{ finalizedAt: string; media: MediaRecord[] }> {
  if (!files) {
    throw new HttpError(400, "MISSING_IMAGES", "The photo strip and frames are required.");
  }

  if (session.finalizedAt) {
    throw new HttpError(409, "ALREADY_FINALIZED", "This photo session has already been finalized.");
  }

  const expectedFrames = FRAME_COUNTS[session.layout];
  const stripFiles = filesFor(files, "strip");
  if (stripFiles.length !== 1) {
    throw new HttpError(400, "MISSING_STRIP", "Exactly one final photo strip is required.");
  }

  const prepared: PreparedFile[] = [];
  const strip = stripFiles[0];
  if (!strip) {
    throw new HttpError(400, "MISSING_STRIP", "Exactly one final photo strip is required.");
  }
  prepared.push(prepareFile(strip, "strip", 0));

  for (let index = 0; index < expectedFrames; index += 1) {
    const frameFiles = filesFor(files, `frame_${index}`);
    if (frameFiles.length !== 1) {
      throw new HttpError(
        400,
        "MISSING_FRAME",
        `Frame ${index + 1} of ${expectedFrames} is required for this layout.`,
      );
    }
    const frame = frameFiles[0];
    if (!frame) {
      throw new HttpError(400, "MISSING_FRAME", "One of the photo frames is missing.");
    }
    prepared.push(prepareFile(frame, "frame", index));
  }

  const writtenFiles: string[] = [];
  try {
    for (const item of prepared) {
      const targetPath = resolveStoredFilePath(item.storedFileName);
      await writeFile(targetPath, item.file.buffer, { flag: "wx", mode: 0o600 });
      writtenFiles.push(item.storedFileName);
    }

    const finalizedAt = new Date().toISOString();
    const media = inTransaction(() => {
      const updated = markSessionFinalized(session.id, finalizedAt);
      if (!updated) {
        throw new HttpError(
          409,
          "ALREADY_FINALIZED",
          "This photo session has already been finalized.",
        );
      }

      for (const item of prepared) {
        insertMedia({
          sessionId: session.id,
          kind: item.kind,
          position: item.position,
          fileName: item.storedFileName,
          mimeType: item.mimeType,
          sizeBytes: item.file.size,
          createdAt: finalizedAt,
        });
      }

      return listMediaBySession(session.id);
    });

    return { finalizedAt, media };
  } catch (error) {
    await removeQuietly(writtenFiles);
    throw error;
  }
}
