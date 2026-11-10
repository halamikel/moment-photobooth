import type { FrameId, LayoutId, MediaKind } from "../../shared/contracts.js";
import { db } from "./database.js";

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

const insertSessionStatement = db.prepare(`
  INSERT INTO sessions (access_token_hash, layout, frame_theme, caption, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const getSessionByIdStatement = db.prepare(`
  SELECT id, access_token_hash, layout, frame_theme, caption, created_at, expires_at, finalized_at
  FROM sessions
  WHERE id = ?
`);

const listExpiredSessionIdsStatement = db.prepare(`
  SELECT id
  FROM sessions
  WHERE expires_at <= ?
  ORDER BY expires_at ASC
  LIMIT ?
`);

const deleteSessionStatement = db.prepare(`
  DELETE FROM sessions
  WHERE id = ?
`);

const listMediaStatement = db.prepare(`
  SELECT id, session_id, kind, position, file_name, mime_type, size_bytes, created_at
  FROM media
  WHERE session_id = ?
  ORDER BY CASE kind WHEN 'strip' THEN 0 ELSE 1 END, position ASC, id ASC
`);

const getMediaStatement = db.prepare(`
  SELECT id, session_id, kind, position, file_name, mime_type, size_bytes, created_at
  FROM media
  WHERE id = ? AND session_id = ?
`);

const insertMediaStatement = db.prepare(`
  INSERT INTO media (session_id, kind, position, file_name, mime_type, size_bytes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const markFinalizedStatement = db.prepare(`
  UPDATE sessions
  SET finalized_at = ?
  WHERE id = ? AND finalized_at IS NULL
`);

const revokeSharesStatement = db.prepare(`
  UPDATE shares
  SET revoked = 1
  WHERE session_id = ? AND revoked = 0
`);

const insertShareStatement = db.prepare(`
  INSERT INTO shares (session_id, token_hash, created_at, expires_at, revoked)
  VALUES (?, ?, ?, ?, 0)
`);

const getShareByHashStatement = db.prepare(`
  SELECT
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
  WHERE shares.token_hash = ?
`);

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
  throw new Error(`Expected numeric column: ${key}`);
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

export function createSession(input: {
  accessTokenHash: string;
  layout: LayoutId;
  frame: FrameId;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
}): SessionRecord {
  const result = insertSessionStatement.run(
    input.accessTokenHash,
    input.layout,
    input.frame,
    input.caption,
    input.createdAt,
    input.expiresAt,
  );

  const session = getSessionById(Number(result.lastInsertRowid));
  if (!session) {
    throw new Error("Session could not be loaded after insertion.");
  }
  return session;
}

export function getSessionById(id: number): SessionRecord | null {
  const row = getSessionByIdStatement.get(id);
  return row ? mapSession(row as DatabaseRow) : null;
}

export function listExpiredSessionIds(expiredAtOrBefore: string, limit: number): number[] {
  return listExpiredSessionIdsStatement
    .all(expiredAtOrBefore, limit)
    .map((row) => requiredNumber(row as DatabaseRow, "id"));
}

export function deleteSessionById(id: number): boolean {
  const result = deleteSessionStatement.run(id);
  return Number(result.changes) === 1;
}

export function listMediaBySession(sessionId: number): MediaRecord[] {
  return listMediaStatement.all(sessionId).map((row) => mapMedia(row as DatabaseRow));
}

export function getMediaForSession(mediaId: number, sessionId: number): MediaRecord | null {
  const row = getMediaStatement.get(mediaId, sessionId);
  return row ? mapMedia(row as DatabaseRow) : null;
}

export function insertMedia(input: {
  sessionId: number;
  kind: MediaKind;
  position: number;
  fileName: string;
  mimeType: "image/png" | "image/jpeg";
  sizeBytes: number;
  createdAt: string;
}): number {
  const result = insertMediaStatement.run(
    input.sessionId,
    input.kind,
    input.position,
    input.fileName,
    input.mimeType,
    input.sizeBytes,
    input.createdAt,
  );
  return Number(result.lastInsertRowid);
}

export function markSessionFinalized(sessionId: number, finalizedAt: string): boolean {
  const result = markFinalizedStatement.run(finalizedAt, sessionId);
  return Number(result.changes) === 1;
}

export function replaceShare(input: {
  sessionId: number;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}): void {
  revokeSharesStatement.run(input.sessionId);
  insertShareStatement.run(
    input.sessionId,
    input.tokenHash,
    input.createdAt,
    input.expiresAt,
  );
}

export function getShareByHash(tokenHash: string): ShareLookup | null {
  const row = getShareByHashStatement.get(tokenHash);
  if (!row) return null;

  const databaseRow = row as DatabaseRow;
  const session = {
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
      revoked: requiredNumber(databaseRow, "share_revoked") === 1,
    },
    session,
  };
}
