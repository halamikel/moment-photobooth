import { del, get, head } from "@vercel/blob";
import { HttpError } from "../utils/http.js";

export interface StoredMediaMetadata {
  contentType: string | null;
  sizeBytes: number;
}

export async function getStoredMediaMetadata(key: string): Promise<StoredMediaMetadata> {
  try {
    const metadata = await head(key);
    return {
      contentType: metadata.contentType,
      sizeBytes: metadata.size,
    };
  } catch {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }
}

export async function deleteStoredMedia(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  try {
    await del(keys);
  } catch {
    // Cleanup is best effort; the cron job retries expired media.
  }
}

export async function openStoredMedia(key: string) {
  return get(key, { access: "private" });
}
