import { inTransaction } from "../db/database.js";
import {
  deleteSessionById,
  listExpiredSessionIds,
  listMediaBySession,
} from "../db/repository.js";
import { deleteStoredMedia } from "./storageService.js";

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 200;

export interface CleanupResult {
  deletedSessions: number;
  deletedFiles: number;
}

export async function cleanupExpiredData(now = new Date()): Promise<CleanupResult> {
  const result: CleanupResult = { deletedSessions: 0, deletedFiles: 0 };
  const expiredAtOrBefore = now.toISOString();

  while (true) {
    const sessionIds = await listExpiredSessionIds(expiredAtOrBefore, CLEANUP_BATCH_SIZE);
    if (sessionIds.length === 0) break;

    for (const sessionId of sessionIds) {
      const fileNames = (await listMediaBySession(sessionId)).map((media) => media.fileName);
      const deleted = await inTransaction(() => deleteSessionById(sessionId));

      if (deleted) {
        result.deletedSessions += 1;
        await deleteStoredMedia(fileNames);
        result.deletedFiles += fileNames.length;
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
