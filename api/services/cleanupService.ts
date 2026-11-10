import { unlink } from "node:fs/promises";
import { inTransaction } from "../db/database.js";
import {
  deleteSessionById,
  listExpiredSessionIds,
  listMediaBySession,
} from "../db/repository.js";
import { resolveStoredFilePath } from "../utils/files.js";

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 200;

export interface CleanupResult {
  deletedSessions: number;
  deletedFiles: number;
}

async function removeFiles(fileNames: string[]): Promise<number> {
  let removed = 0;

  await Promise.all(
    fileNames.map(async (fileName) => {
      try {
        await unlink(resolveStoredFilePath(fileName));
        removed += 1;
      } catch {
        // A missing file is already clean; other errors are retried next run.
      }
    }),
  );

  return removed;
}

export async function cleanupExpiredData(
  now = new Date(),
): Promise<CleanupResult> {
  const result: CleanupResult = { deletedSessions: 0, deletedFiles: 0 };
  const expiredAtOrBefore = now.toISOString();

  while (true) {
    const sessionIds = listExpiredSessionIds(expiredAtOrBefore, CLEANUP_BATCH_SIZE);
    if (sessionIds.length === 0) break;

    for (const sessionId of sessionIds) {
      const fileNames = listMediaBySession(sessionId).map((media) => media.fileName);
      const deleted = inTransaction(() => deleteSessionById(sessionId));

      if (deleted) {
        result.deletedSessions += 1;
        result.deletedFiles += await removeFiles(fileNames);
      }
    }

    if (sessionIds.length < CLEANUP_BATCH_SIZE) break;
  }

  return result;
}

export function startCleanupJob(): void {
  const run = () => {
    void cleanupExpiredData()
      .then((result) => {
        if (result.deletedSessions > 0) {
          console.log(
            `[cleanup] Removed ${result.deletedSessions} expired session(s) and ${result.deletedFiles} file(s).`,
          );
        }
      })
      .catch((error: unknown) => {
        console.error("[cleanup] Failed to remove expired data.", error);
      });
  };

  const initialRun = setTimeout(run, 5_000);
  initialRun.unref();

  const interval = setInterval(run, CLEANUP_INTERVAL_MS);
  interval.unref();
}
