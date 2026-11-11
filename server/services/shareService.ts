import { config } from "../config.js";
import { inTransaction } from "../db/database.js";
import {
  getShareByHash,
  listMediaBySession,
  replaceShare,
  type MediaRecord,
  type SessionRecord,
  type ShareLookup,
} from "../db/repository.js";
import { HttpError } from "../utils/http.js";
import { createOpaqueToken, hashToken, isWellFormedToken } from "../utils/tokens.js";

export interface CreatedShare {
  token: string;
  expiresAt: string;
}

export async function createShareForSession(session: SessionRecord): Promise<CreatedShare> {
  if (!session.finalizedAt) {
    throw new HttpError(
      409,
      "SESSION_NOT_FINALIZED",
      "Finalize the photo strip before creating a share link.",
    );
  }

  const token = createOpaqueToken();
  const now = Date.now();
  const sessionExpiry = Date.parse(session.expiresAt);
  const expiresAt = new Date(
    Math.min(now + config.shareTtlMs, sessionExpiry),
  ).toISOString();

  await inTransaction(async () => {
    await replaceShare({
      sessionId: session.id,
      tokenHash: hashToken(token),
      createdAt: new Date(now).toISOString(),
      expiresAt,
    });
  });

  return { token, expiresAt };
}

export async function resolveShareToken(token: unknown): Promise<{
  token: string;
  lookup: ShareLookup;
  media: MediaRecord[];
}> {
  if (typeof token !== "string" || !isWellFormedToken(token)) {
    throw new HttpError(
      404,
      "SHARE_UNAVAILABLE",
      "This share link is unavailable or has expired.",
    );
  }

  const lookup = await getShareByHash(hashToken(token));
  if (!lookup) {
    throw new HttpError(
      404,
      "SHARE_UNAVAILABLE",
      "This share link is unavailable or has expired.",
    );
  }

  const now = Date.now();
  const shareExpired = Date.parse(lookup.share.expiresAt) <= now;
  const sessionExpired = Date.parse(lookup.session.expiresAt) <= now;
  if (
    lookup.share.revoked ||
    shareExpired ||
    sessionExpired ||
    !lookup.session.finalizedAt
  ) {
    throw new HttpError(
      404,
      "SHARE_UNAVAILABLE",
      "This share link is unavailable or has expired.",
    );
  }

  return {
    token,
    lookup,
    media: await listMediaBySession(lookup.session.id),
  };
}
