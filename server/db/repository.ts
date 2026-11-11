import type { FrameId, LayoutId, MediaKind } from "../../shared/contracts.js";
import { query } from "./database.js";

type DatabaseRow = Record<string, unknown>;

export interface SessionRecord {
  id: number;
  accessTokenHash: string;
  layout: LayoutId;
  frame: FrameId;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
  finalizedAt: string | null;
}

export interface MediaRecord {
  id: number;
  sessionId: number;
  kind: MediaKind;
  position: number;
  fileName: string;
  mimeType: "image/png" | "image/jpeg";
  sizeBytes: number;
  createdAt: string;
}

export interface ShareRecord {
  id: number;
  sessionId: number;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
}

export interface ShareLookup {
  share: ShareRecord;
  session: SessionRecord;
}

function requiredString(row: DatabaseRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string column: ${key}`);
  }
  return value;
}

function nullableString(row: DatabaseRow, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`Expected nullable string column: ${key}`);
  }
  return value;
}

function requiredNumber(row: DatabaseRow, key: string): number {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  throw new Error(`Expected numeric column: ${key}`);
}

function requiredBoolean(row: DatabaseRow, key: string): boolean {
  const value = row[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  throw new Error(`Expected boolean column: ${key}`);
}

function mapSession(row: DatabaseRow, prefix = ""): SessionRecord {
  return {
    id: requiredNumber(row, `${prefix}id`),
    accessTokenHash: requiredString(row, `${prefix}access_token_hash`),
    layout: requiredString(row, `${prefix}layout`) as LayoutId,
    frame: requiredString(row, `${prefix}frame_theme`) as FrameId,
    caption: nullableString(row, `${prefix}caption`),
    createdAt: requiredString(row, `${prefix}created_at`),
    expiresAt: requiredString(row, `${prefix}expires_at`),
    finalizedAt: nullableString(row, `${prefix}finalized_at`),
  };
}

function mapMedia(row: DatabaseRow): MediaRecord {
  return {
    id: requiredNumber(row, "id"),
    sessionId: requiredNumber(row, "session_id"),
    kind: requiredString(row, "kind") as MediaKind,
    position: requiredNumber(row, "position"),
    fileName: requiredString(row, "file_name"),
    mimeType: requiredString(row, "mime_type") as MediaRecord["mimeType"],
    sizeBytes: requiredNumber(row, "size_bytes"),
    createdAt: requiredString(row, "created_at"),
  };
}

export async function createSession(input: {
  accessTokenHash: string;
  layout: LayoutId;
  frame: FrameId;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
}): Promise<SessionRecord> {
  const result = await query<{ id: number }>(
    `INSERT INTO sessions (access_token_hash, layout, frame_theme, caption, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.accessTokenHash,
      input.layout,
      input.frame,
      input.caption,
      input.createdAt,
      input.expiresAt,
    ],
  );

  const session = await getSessionById(requiredNumber(result.rows[0] as DatabaseRow, "id"));
  if (!session) {
    throw new Error("Session could not be loaded after insertion.");
  }
  return session;
}

export async function getSessionById(id: number): Promise<SessionRecord | null> {
  const result = await query(
    `SELECT id, access_token_hash, layout, frame_theme, caption, created_at, expires_at, finalized_at
     FROM sessions
     WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? mapSession(row as DatabaseRow) : null;
}

export async function listExpiredSessionIds(
  expiredAtOrBefore: string,
  limit: number,
): Promise<number[]> {
  const result = await query(
    `SELECT id
     FROM sessions
     WHERE expires_at <= $1
     ORDER BY expires_at ASC
     LIMIT $2`,
    [expiredAtOrBefore, limit],
  );
  return result.rows.map((row) => requiredNumber(row as DatabaseRow, "id"));
}

export async function deleteSessionById(id: number): Promise<boolean> {
  const result = await query("DELETE FROM sessions WHERE id = $1", [id]);
  return (result.rowCount ?? 0) === 1;
}

export async function listMediaBySession(sessionId: number): Promise<MediaRecord[]> {
  const result = await query(
    `SELECT id, session_id, kind, position, file_name, mime_type, size_bytes, created_at
     FROM media
     WHERE session_id = $1
     ORDER BY CASE kind WHEN 'strip' THEN 0 ELSE 1 END, position ASC, id ASC`,
    [sessionId],
  );
  return result.rows.map((row) => mapMedia(row as DatabaseRow));
}

export async function getMediaForSession(
  mediaId: number,
  sessionId: number,
): Promise<MediaRecord | null> {
  const result = await query(
    `SELECT id, session_id, kind, position, file_name, mime_type, size_bytes, created_at
     FROM media
     WHERE id = $1 AND session_id = $2`,
    [mediaId, sessionId],
  );
  const row = result.rows[0];
  return row ? mapMedia(row as DatabaseRow) : null;
}

export async function insertMedia(input: {
  sessionId: number;
  kind: MediaKind;
  position: number;
  fileName: string;
  mimeType: "image/png" | "image/jpeg";
  sizeBytes: number;
  createdAt: string;
}): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO media (session_id, kind, position, file_name, mime_type, size_bytes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.sessionId,
      input.kind,
      input.position,
      input.fileName,
      input.mimeType,
      input.sizeBytes,
      input.createdAt,
    ],
  );
  return requiredNumber(result.rows[0] as DatabaseRow, "id");
}

export async function markSessionFinalized(
  sessionId: number,
  finalizedAt: string,
): Promise<boolean> {
  const result = await query(
    "UPDATE sessions SET finalized_at = $1 WHERE id = $2 AND finalized_at IS NULL",
    [finalizedAt, sessionId],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function replaceShare(input: {
  sessionId: number;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}): Promise<void> {
  await query("UPDATE shares SET revoked = TRUE WHERE session_id = $1 AND revoked = FALSE", [
    input.sessionId,
  ]);
  await query(
    `INSERT INTO shares (session_id, token_hash, created_at, expires_at, revoked)
     VALUES ($1, $2, $3, $4, FALSE)`,
    [input.sessionId, input.tokenHash, input.createdAt, input.expiresAt],
  );
}

export async function getShareByHash(tokenHash: string): Promise<ShareLookup | null> {
  const result = await query(
    `SELECT
       shares.id AS share_id,
       shares.session_id AS share_session_id,
       shares.token_hash AS share_token_hash,
       shares.created_at AS share_created_at,
       shares.expires_at AS share_expires_at,
       shares.revoked AS share_revoked,
       sessions.access_token_hash AS session_access_token_hash,
       sessions.layout AS session_layout,
       sessions.frame_theme AS session_frame_theme,
       sessions.caption AS session_caption,
       sessions.created_at AS session_created_at,
       sessions.expires_at AS session_expires_at,
       sessions.finalized_at AS session_finalized_at
     FROM shares
     INNER JOIN sessions ON sessions.id = shares.session_id
     WHERE shares.token_hash = $1`,
    [tokenHash],
  );

  const row = result.rows[0];
  if (!row) return null;

  const databaseRow = row as DatabaseRow;
  const session: SessionRecord = {
    id: requiredNumber(databaseRow, "share_session_id"),
    accessTokenHash: requiredString(databaseRow, "session_access_token_hash"),
    layout: requiredString(databaseRow, "session_layout") as LayoutId,
    frame: requiredString(databaseRow, "session_frame_theme") as FrameId,
    caption: nullableString(databaseRow, "session_caption"),
    createdAt: requiredString(databaseRow, "session_created_at"),
    expiresAt: requiredString(databaseRow, "session_expires_at"),
    finalizedAt: nullableString(databaseRow, "session_finalized_at"),
  };

  return {
    share: {
      id: requiredNumber(databaseRow, "share_id"),
      sessionId: requiredNumber(databaseRow, "share_session_id"),
      tokenHash: requiredString(databaseRow, "share_token_hash"),
      createdAt: requiredString(databaseRow, "share_created_at"),
      expiresAt: requiredString(databaseRow, "share_expires_at"),
      revoked: requiredBoolean(databaseRow, "share_revoked"),
    },
    session,
  };
}
