// server/app.ts
import fs from "node:fs";
import path2 from "node:path";
import express from "express";

// server/config.ts
import "dotenv/config";
import path from "node:path";
import { z } from "zod";
var envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4e3),
  TRUST_PROXY: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@127.0.0.1:5432/moment"),
  DATABASE_SSL: z.preprocess(
    (value) => value === "" ? void 0 : value,
    z.enum(["true", "false"]).optional()
  ),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  SHARE_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  WEB_DIST: z.string().min(1).default("./dist"),
  CRON_SECRET: z.preprocess(
    (value) => value === "" ? void 0 : value,
    z.string().min(1).optional()
  )
});
var parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
var env = parsed.data;
function resolveRuntimePath(value) {
  return path.resolve(process.cwd(), value);
}
function defaultDatabaseSsl(databaseUrl) {
  try {
    const hostname = new URL(databaseUrl).hostname;
    return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1";
  } catch {
    return false;
  }
}
var config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isServerless: Boolean(process.env.VERCEL),
  port: env.PORT,
  trustProxy: env.TRUST_PROXY || Boolean(process.env.VERCEL),
  databaseUrl: env.DATABASE_URL,
  databaseSsl: env.DATABASE_SSL === void 0 ? defaultDatabaseSsl(env.DATABASE_URL) : env.DATABASE_SSL === "true",
  webDist: resolveRuntimePath(env.WEB_DIST),
  cronSecret: env.CRON_SECRET,
  sessionTtlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1e3,
  shareTtlMs: env.SHARE_TTL_HOURS * 60 * 60 * 1e3,
  maxUploadBytes: 10 * 1024 * 1024,
  maxCaptionLength: 40
};

// server/db/database.ts
import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";

// server/db/schema.ts
var DATABASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  access_token_hash TEXT NOT NULL UNIQUE,
  layout TEXT NOT NULL CHECK (layout IN ('classic', 'grid', 'postcard')),
  frame_theme TEXT NOT NULL CHECK (frame_theme IN ('cream', 'blush', 'noir', 'porcelain', 'sky', 'lilac', 'sunset')),
  caption TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  finalized_at TEXT
);

CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('frame', 'strip')),
  position INTEGER NOT NULL CHECK (position >= 0),
  file_name TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shares (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_media_session ON media(session_id);
CREATE INDEX IF NOT EXISTS idx_media_session_kind ON media(session_id, kind, position);
CREATE INDEX IF NOT EXISTS idx_shares_session ON shares(session_id);
CREATE INDEX IF NOT EXISTS idx_shares_hash ON shares(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
`;

// server/db/database.ts
var { Pool } = pg;
var pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : void 0,
  max: config.isServerless ? 1 : 10,
  idleTimeoutMillis: 3e4
});
pool.on("error", (error) => {
  console.error("[db] unexpected idle client error", error);
});
var transactionStorage = new AsyncLocalStorage();
function query(text, params = []) {
  const client = transactionStorage.getStore() ?? pool;
  return client.query(text, params);
}
async function inTransaction(work) {
  if (transactionStorage.getStore()) {
    return work();
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await transactionStorage.run(client, work);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => void 0);
    throw error;
  } finally {
    client.release();
  }
}
var schemaPromise = null;
function ensureDatabaseSchema() {
  schemaPromise ??= inTransaction(async () => {
    await query("SELECT pg_advisory_xact_lock(hashtext('moment_schema'))");
    await query(DATABASE_SCHEMA);
  }).catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

// server/db/repository.ts
function requiredString(row, key) {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string column: ${key}`);
  }
  return value;
}
function nullableString(row, key) {
  const value = row[key];
  if (value === null || value === void 0) return null;
  if (typeof value !== "string") {
    throw new Error(`Expected nullable string column: ${key}`);
  }
  return value;
}
function requiredNumber(row, key) {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  throw new Error(`Expected numeric column: ${key}`);
}
function requiredBoolean(row, key) {
  const value = row[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  throw new Error(`Expected boolean column: ${key}`);
}
function mapSession(row, prefix = "") {
  return {
    id: requiredNumber(row, `${prefix}id`),
    accessTokenHash: requiredString(row, `${prefix}access_token_hash`),
    layout: requiredString(row, `${prefix}layout`),
    frame: requiredString(row, `${prefix}frame_theme`),
    caption: nullableString(row, `${prefix}caption`),
    createdAt: requiredString(row, `${prefix}created_at`),
    expiresAt: requiredString(row, `${prefix}expires_at`),
    finalizedAt: nullableString(row, `${prefix}finalized_at`)
  };
}
function mapMedia(row) {
  return {
    id: requiredNumber(row, "id"),
    sessionId: requiredNumber(row, "session_id"),
    kind: requiredString(row, "kind"),
    position: requiredNumber(row, "position"),
    fileName: requiredString(row, "file_name"),
    mimeType: requiredString(row, "mime_type"),
    sizeBytes: requiredNumber(row, "size_bytes"),
    createdAt: requiredString(row, "created_at")
  };
}
async function createSession(input) {
  const result = await query(
    `INSERT INTO sessions (access_token_hash, layout, frame_theme, caption, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.accessTokenHash,
      input.layout,
      input.frame,
      input.caption,
      input.createdAt,
      input.expiresAt
    ]
  );
  const session = await getSessionById(requiredNumber(result.rows[0], "id"));
  if (!session) {
    throw new Error("Session could not be loaded after insertion.");
  }
  return session;
}
async function getSessionById(id) {
  const result = await query(
    `SELECT id, access_token_hash, layout, frame_theme, caption, created_at, expires_at, finalized_at
     FROM sessions
     WHERE id = $1`,
    [id]
  );
  const row = result.rows[0];
  return row ? mapSession(row) : null;
}
async function listExpiredSessionIds(expiredAtOrBefore, limit) {
  const result = await query(
    `SELECT id
     FROM sessions
     WHERE expires_at <= $1
     ORDER BY expires_at ASC
     LIMIT $2`,
    [expiredAtOrBefore, limit]
  );
  return result.rows.map((row) => requiredNumber(row, "id"));
}
async function deleteSessionById(id) {
  const result = await query("DELETE FROM sessions WHERE id = $1", [id]);
  return (result.rowCount ?? 0) === 1;
}
async function listMediaBySession(sessionId) {
  const result = await query(
    `SELECT id, session_id, kind, position, file_name, mime_type, size_bytes, created_at
     FROM media
     WHERE session_id = $1
     ORDER BY CASE kind WHEN 'strip' THEN 0 ELSE 1 END, position ASC, id ASC`,
    [sessionId]
  );
  return result.rows.map((row) => mapMedia(row));
}
async function getMediaForSession(mediaId, sessionId) {
  const result = await query(
    `SELECT id, session_id, kind, position, file_name, mime_type, size_bytes, created_at
     FROM media
     WHERE id = $1 AND session_id = $2`,
    [mediaId, sessionId]
  );
  const row = result.rows[0];
  return row ? mapMedia(row) : null;
}
async function insertMedia(input) {
  const result = await query(
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
      input.createdAt
    ]
  );
  return requiredNumber(result.rows[0], "id");
}
async function markSessionFinalized(sessionId, finalizedAt) {
  const result = await query(
    "UPDATE sessions SET finalized_at = $1 WHERE id = $2 AND finalized_at IS NULL",
    [finalizedAt, sessionId]
  );
  return (result.rowCount ?? 0) === 1;
}
async function replaceShare(input) {
  await query("UPDATE shares SET revoked = TRUE WHERE session_id = $1 AND revoked = FALSE", [
    input.sessionId
  ]);
  await query(
    `INSERT INTO shares (session_id, token_hash, created_at, expires_at, revoked)
     VALUES ($1, $2, $3, $4, FALSE)`,
    [input.sessionId, input.tokenHash, input.createdAt, input.expiresAt]
  );
}
async function getShareByHash(tokenHash) {
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
    [tokenHash]
  );
  const row = result.rows[0];
  if (!row) return null;
  const databaseRow = row;
  const session = {
    id: requiredNumber(databaseRow, "share_session_id"),
    accessTokenHash: requiredString(databaseRow, "session_access_token_hash"),
    layout: requiredString(databaseRow, "session_layout"),
    frame: requiredString(databaseRow, "session_frame_theme"),
    caption: nullableString(databaseRow, "session_caption"),
    createdAt: requiredString(databaseRow, "session_created_at"),
    expiresAt: requiredString(databaseRow, "session_expires_at"),
    finalizedAt: nullableString(databaseRow, "session_finalized_at")
  };
  return {
    share: {
      id: requiredNumber(databaseRow, "share_id"),
      sessionId: requiredNumber(databaseRow, "share_session_id"),
      tokenHash: requiredString(databaseRow, "share_token_hash"),
      createdAt: requiredString(databaseRow, "share_created_at"),
      expiresAt: requiredString(databaseRow, "share_expires_at"),
      revoked: requiredBoolean(databaseRow, "share_revoked")
    },
    session
  };
}

// server/utils/http.ts
import sanitizeHtml from "sanitize-html";
var HttpError = class extends Error {
  status;
  code;
  details;
  constructor(status, code, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
};
function asyncHandler(handler) {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}
function parsePositiveInt(value, label = "identifier") {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !/^[1-9]\d{0,9}$/.test(raw)) {
    throw new HttpError(400, "INVALID_IDENTIFIER", `Invalid ${label}.`);
  }
  const parsed2 = Number(raw);
  if (!Number.isSafeInteger(parsed2) || parsed2 < 1) {
    throw new HttpError(400, "INVALID_IDENTIFIER", `Invalid ${label}.`);
  }
  return parsed2;
}
function sanitizePlainText(value) {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard"
  }).replace(/\s+/g, " ").trim().slice(0, config.maxCaptionLength);
}
function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
}

// server/utils/tokens.ts
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
var TOKEN_PATTERN = /^[a-f0-9]{64}$/;
function createOpaqueToken() {
  return randomBytes(32).toString("hex");
}
function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
function isWellFormedToken(token) {
  return TOKEN_PATTERN.test(token);
}
function tokenHashesMatch(leftHex, rightHex) {
  if (!/^[a-f0-9]{64}$/.test(leftHex) || !/^[a-f0-9]{64}$/.test(rightHex)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(leftHex, "hex"), Buffer.from(rightHex, "hex"));
}

// server/middleware/auth.ts
var sessionByRequest = /* @__PURE__ */ new WeakMap();
async function authenticateSessionToken(token, sessionId) {
  if (!isWellFormedToken(token)) {
    throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
  }
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
  }
  if (!tokenHashesMatch(session.accessTokenHash, hashToken(token))) {
    throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
  }
  if (Date.parse(session.expiresAt) <= Date.now()) {
    throw new HttpError(401, "SESSION_EXPIRED", "This photo session has expired.");
  }
  return session;
}
function bearerTokenFromHeader(authorization) {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length).trim();
}
var requireSessionAccess = (req, _res, next) => {
  void (async () => {
    try {
      const token = bearerTokenFromHeader(req.get("authorization"));
      if (!token) {
        throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
      }
      const sessionId = parsePositiveInt(req.params.id, "session id");
      const session = await authenticateSessionToken(token, sessionId);
      sessionByRequest.set(req, session);
      next();
    } catch (error) {
      next(error);
    }
  })();
};
function authenticatedSession(req) {
  const session = sessionByRequest.get(req);
  if (!session) {
    throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
  }
  return session;
}

// server/middleware/errors.ts
import { ZodError } from "zod";
var apiNotFound = (_req, res) => {
  res.status(404).json({ error: "That API route does not exist." });
};
var errorHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: error.message,
      ...error.details ? { details: error.details } : {}
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Please check the submitted details.",
      details: error.flatten().fieldErrors
    });
    return;
  }
  const parserError = error;
  if (parserError.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON body." });
    return;
  }
  if (parserError.type === "entity.too.large" || parserError.status === 413) {
    res.status(413).json({ error: "The request body is too large." });
    return;
  }
  if (parserError.status === 400 || parserError.statusCode === 400) {
    res.status(400).json({ error: "The request could not be processed." });
    return;
  }
  console.error("[api] unhandled error", error);
  res.status(500).json({
    error: config.isProduction ? "Something went wrong. Please try again." : "Something went wrong. Check the server logs."
  });
};

// server/middleware/rateLimit.ts
import { rateLimit } from "express-rate-limit";
function createLimiter(options) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: "Too many requests. Please wait a moment and try again."
      });
    }
  });
}
var apiLimiter = createLimiter({ windowMs: 15 * 60 * 1e3, limit: 600 });
var sessionCreateLimiter = createLimiter({ windowMs: 10 * 60 * 1e3, limit: 20 });
var uploadLimiter = createLimiter({ windowMs: 60 * 1e3, limit: 10 });
var shareCreateLimiter = createLimiter({ windowMs: 60 * 1e3, limit: 10 });
var downloadLimiter = createLimiter({ windowMs: 60 * 1e3, limit: 120 });

// server/middleware/security.ts
import helmet from "helmet";
var cspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
  imgSrc: ["'self'", "data:", "blob:"],
  mediaSrc: ["'self'", "blob:"],
  connectSrc: [
    "'self'",
    "https://blob.vercel-storage.com",
    "https://*.blob.vercel-storage.com"
  ],
  workerSrc: ["'self'", "blob:"],
  manifestSrc: ["'self'"],
  frameSrc: ["'none'"]
};
if (config.isProduction) {
  cspDirectives.upgradeInsecureRequests = [];
}
var securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: cspDirectives
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "same-origin" },
  referrerPolicy: { policy: "no-referrer" },
  frameguard: { action: "deny" },
  noSniff: true,
  hsts: config.isProduction ? {
    maxAge: 15552e3,
    includeSubDomains: true,
    preload: true
  } : false
});
var permissionsPolicy = (_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=()"
  );
  next();
};

// server/routes/blobRoutes.ts
import { Router } from "express";
import { handleUpload } from "@vercel/blob/client";

// server/utils/files.ts
var MEDIA_KEY_PATTERN = /^media\/([1-9]\d{0,9})\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(png|jpg)$/;
function parseMediaKey(key) {
  if (typeof key !== "string") {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }
  const match = MEDIA_KEY_PATTERN.exec(key);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }
  const sessionId = Number(match[1]);
  if (!Number.isSafeInteger(sessionId) || sessionId < 1) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }
  return {
    sessionId,
    extension: match[3]
  };
}

// server/utils/image.ts
var ALLOWED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg"];
function isAllowedImageMimeType(value) {
  return ALLOWED_IMAGE_MIME_TYPES.some((mime) => mime === value);
}

// server/routes/blobRoutes.ts
var blobRoutes = Router();
blobRoutes.post(
  "/blob-upload",
  asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "INVALID_UPLOAD_REQUEST", "The upload request is invalid.");
    }
    const response = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const token = bearerTokenFromHeader(req.get("authorization"));
        if (!token) {
          throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
        }
        const parsed2 = parseMediaKey(pathname);
        await authenticateSessionToken(token, parsed2.sessionId);
        return {
          allowedContentTypes: [...ALLOWED_IMAGE_MIME_TYPES],
          maximumSizeInBytes: config.maxUploadBytes,
          addRandomSuffix: false,
          allowOverwrite: false
        };
      }
    });
    res.json(response);
  })
);

// server/routes/sessionRoutes.ts
import { Router as Router2 } from "express";

// server/controllers/sessionController.ts
import { z as z2 } from "zod";

// shared/contracts.ts
var LAYOUT_IDS = ["classic", "grid", "postcard"];
var FRAME_IDS = [
  "cream",
  "blush",
  "noir",
  "porcelain",
  "sky",
  "lilac",
  "sunset"
];
var FRAME_COUNTS = {
  classic: 4,
  grid: 4,
  postcard: 1
};

// server/services/storageService.ts
import { del, get, head } from "@vercel/blob";
async function getStoredMediaMetadata(key) {
  try {
    const metadata = await head(key);
    return {
      contentType: metadata.contentType,
      sizeBytes: metadata.size
    };
  } catch {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }
}
async function deleteStoredMedia(keys) {
  if (keys.length === 0) return;
  try {
    await del(keys);
  } catch {
  }
}
async function openStoredMedia(key) {
  return get(key, { access: "private" });
}

// server/services/finalizeService.ts
function extensionMatchesMimeType(extension, mimeType) {
  return extension === (mimeType === "image/png" ? "png" : "jpg");
}
async function prepareFile(key, sessionId, kind, position) {
  const parsed2 = parseMediaKey(key);
  if (parsed2.sessionId !== sessionId) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }
  const metadata = await getStoredMediaMetadata(key);
  if (!metadata.contentType || !isAllowedImageMimeType(metadata.contentType) || !extensionMatchesMimeType(parsed2.extension, metadata.contentType)) {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Only PNG and JPEG images are accepted."
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
    sizeBytes: metadata.sizeBytes
  };
}
async function finalizeSessionMedia(session, input) {
  if (session.finalizedAt) {
    throw new HttpError(409, "ALREADY_FINALIZED", "This photo session has already been finalized.");
  }
  const expectedFrames = FRAME_COUNTS[session.layout];
  if (input.frames.length !== expectedFrames) {
    throw new HttpError(
      400,
      "MISSING_FRAME",
      `Exactly ${expectedFrames} frame image(s) are required for this layout.`
    );
  }
  const ownedKeys = [];
  try {
    const prepared = [];
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
    const finalizedAt = (/* @__PURE__ */ new Date()).toISOString();
    const media = await inTransaction(async () => {
      const updated = await markSessionFinalized(session.id, finalizedAt);
      if (!updated) {
        throw new HttpError(
          409,
          "ALREADY_FINALIZED",
          "This photo session has already been finalized."
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
          createdAt: finalizedAt
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

// server/services/mediaService.ts
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
function extensionFor(fileName) {
  return fileName.endsWith(".png") ? "png" : "jpg";
}
function toOwnerMediaSummary(media, sessionId) {
  const base = `/api/sessions/${sessionId}/media/${media.id}`;
  return {
    id: media.id,
    kind: media.kind,
    position: media.position,
    url: base,
    downloadUrl: `${base}?download=1`
  };
}
function toShareMediaSummary(media, shareToken) {
  const base = `/api/shares/${encodeURIComponent(shareToken)}/media/${media.id}`;
  return {
    id: media.id,
    kind: media.kind,
    position: media.position,
    url: base,
    downloadUrl: `${base}?download=1`
  };
}
async function sendStoredMedia(res, media, download) {
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
    `${disposition}; filename="moment-${media.kind}-${media.id}.${extension}"`
  );
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  const nodeStream = Readable.fromWeb(
    result.stream
  );
  await pipeline(nodeStream, res);
}

// server/services/shareService.ts
async function createShareForSession(session) {
  if (!session.finalizedAt) {
    throw new HttpError(
      409,
      "SESSION_NOT_FINALIZED",
      "Finalize the photo strip before creating a share link."
    );
  }
  const token = createOpaqueToken();
  const now = Date.now();
  const sessionExpiry = Date.parse(session.expiresAt);
  const expiresAt = new Date(
    Math.min(now + config.shareTtlMs, sessionExpiry)
  ).toISOString();
  await inTransaction(async () => {
    await replaceShare({
      sessionId: session.id,
      tokenHash: hashToken(token),
      createdAt: new Date(now).toISOString(),
      expiresAt
    });
  });
  return { token, expiresAt };
}
async function resolveShareToken(token) {
  if (typeof token !== "string" || !isWellFormedToken(token)) {
    throw new HttpError(
      404,
      "SHARE_UNAVAILABLE",
      "This share link is unavailable or has expired."
    );
  }
  const lookup = await getShareByHash(hashToken(token));
  if (!lookup) {
    throw new HttpError(
      404,
      "SHARE_UNAVAILABLE",
      "This share link is unavailable or has expired."
    );
  }
  const now = Date.now();
  const shareExpired = Date.parse(lookup.share.expiresAt) <= now;
  const sessionExpired = Date.parse(lookup.session.expiresAt) <= now;
  if (lookup.share.revoked || shareExpired || sessionExpired || !lookup.session.finalizedAt) {
    throw new HttpError(
      404,
      "SHARE_UNAVAILABLE",
      "This share link is unavailable or has expired."
    );
  }
  return {
    token,
    lookup,
    media: await listMediaBySession(lookup.session.id)
  };
}

// server/controllers/sessionController.ts
var createSessionSchema = z2.object({
  layout: z2.enum(LAYOUT_IDS),
  frame: z2.enum(FRAME_IDS),
  caption: z2.string().max(200).optional().default("")
}).strict();
var finalizeSchema = z2.object({
  strip: z2.string().min(1),
  frames: z2.array(z2.string().min(1)).min(1).max(4)
}).strict();
function toSessionSummary(session) {
  return {
    id: session.id,
    layout: session.layout,
    frame: session.frame,
    caption: session.caption,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    finalizedAt: session.finalizedAt
  };
}
async function createSessionHandler(req, res) {
  const body = createSessionSchema.parse(req.body);
  const caption = sanitizePlainText(body.caption);
  const accessToken = createOpaqueToken();
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + config.sessionTtlMs).toISOString();
  const session = await createSession({
    accessTokenHash: hashToken(accessToken),
    layout: body.layout,
    frame: body.frame,
    caption: caption.length > 0 ? caption : null,
    createdAt: now.toISOString(),
    expiresAt
  });
  const response = {
    session: toSessionSummary(session),
    accessToken
  };
  res.status(201).json(response);
}
async function getSessionHandler(req, res) {
  const session = authenticatedSession(req);
  const media = (await listMediaBySession(session.id)).map(
    (item) => toOwnerMediaSummary(item, session.id)
  );
  const response = {
    session: toSessionSummary(session),
    media
  };
  res.json(response);
}
async function finalizeSessionHandler(req, res) {
  const session = authenticatedSession(req);
  const body = finalizeSchema.parse(req.body);
  const result = await finalizeSessionMedia(session, body);
  const updated = await getSessionById(session.id);
  if (!updated) {
    throw new HttpError(500, "SESSION_MISSING", "The photo session could not be loaded.");
  }
  const response = {
    session: toSessionSummary(updated),
    media: result.media.map((item) => toOwnerMediaSummary(item, updated.id)),
    message: "Your photo strip is ready."
  };
  res.status(201).json(response);
}
async function createShareHandler(req, res) {
  const session = authenticatedSession(req);
  const share = await createShareForSession(session);
  const response = {
    token: share.token,
    expiresAt: share.expiresAt,
    path: `/share/${share.token}`
  };
  res.status(201).json(response);
}
async function getOwnerMediaHandler(req, res) {
  const session = authenticatedSession(req);
  const mediaId = parsePositiveInt(req.params.mediaId, "media id");
  const media = await getMediaForSession(mediaId, session.id);
  if (!media) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }
  await sendStoredMedia(res, media, req.query.download === "1");
}

// server/routes/sessionRoutes.ts
var sessionRoutes = Router2();
sessionRoutes.post("/", sessionCreateLimiter, asyncHandler(createSessionHandler));
sessionRoutes.get("/:id", requireSessionAccess, asyncHandler(getSessionHandler));
sessionRoutes.post(
  "/:id/finalize",
  uploadLimiter,
  requireSessionAccess,
  asyncHandler(finalizeSessionHandler)
);
sessionRoutes.post(
  "/:id/share",
  shareCreateLimiter,
  requireSessionAccess,
  asyncHandler(createShareHandler)
);
sessionRoutes.get(
  "/:id/media/:mediaId",
  downloadLimiter,
  requireSessionAccess,
  asyncHandler(getOwnerMediaHandler)
);

// server/routes/shareRoutes.ts
import { Router as Router3 } from "express";

// server/controllers/shareController.ts
async function getShareHandler(req, res) {
  const { token, lookup, media } = await resolveShareToken(req.params.token);
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  const response = {
    layout: lookup.session.layout,
    frame: lookup.session.frame,
    caption: lookup.session.caption,
    createdAt: lookup.session.createdAt,
    expiresAt: lookup.share.expiresAt,
    media: media.map((item) => toShareMediaSummary(item, token))
  };
  res.json(response);
}
async function getShareMediaHandler(req, res) {
  const { lookup } = await resolveShareToken(req.params.token);
  const mediaId = parsePositiveInt(req.params.mediaId, "media id");
  const media = await getMediaForSession(mediaId, lookup.session.id);
  if (!media) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }
  await sendStoredMedia(res, media, req.query.download === "1");
}

// server/routes/shareRoutes.ts
var shareRoutes = Router3();
shareRoutes.get("/:token", downloadLimiter, asyncHandler(getShareHandler));
shareRoutes.get(
  "/:token/media/:mediaId",
  downloadLimiter,
  asyncHandler(getShareMediaHandler)
);

// server/services/cleanupService.ts
var CLEANUP_INTERVAL_MS = 15 * 60 * 1e3;
var CLEANUP_BATCH_SIZE = 200;
async function cleanupExpiredData(now = /* @__PURE__ */ new Date()) {
  const result = { deletedSessions: 0, deletedFiles: 0 };
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

// server/app.ts
function timingSafeEqual2(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) {
    app.set("trust proxy", 1);
  }
  app.use(securityHeaders);
  app.use(permissionsPolicy);
  app.use(
    express.json({
      limit: "32kb",
      strict: true,
      type: "application/json"
    })
  );
  app.get("/api/health", noStore, (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api", noStore, (_req, _res, next) => {
    ensureDatabaseSchema().then(() => next(), next);
  });
  app.get("/api/cron/cleanup", async (req, res, next) => {
    try {
      if (config.cronSecret) {
        const token = bearerTokenFromHeader(req.get("authorization"));
        if (!token || !timingSafeEqual2(token, config.cronSecret)) {
          throw new HttpError(401, "UNAUTHORIZED", "Cron authorization failed.");
        }
      } else if (config.isProduction) {
        throw new HttpError(401, "UNAUTHORIZED", "Cron authorization failed.");
      }
      const result = await cleanupExpiredData();
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });
  app.use("/api", apiLimiter);
  app.use("/api", blobRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/shares", shareRoutes);
  app.use("/api", apiNotFound);
  if (fs.existsSync(config.webDist)) {
    app.use(
      "/assets",
      express.static(path2.join(config.webDist, "assets"), {
        index: false,
        dotfiles: "deny",
        maxAge: "1y",
        immutable: true
      })
    );
    app.use(
      express.static(config.webDist, {
        index: false,
        dotfiles: "deny",
        maxAge: 0
      })
    );
    app.use((req, res, next) => {
      if (req.method !== "GET") {
        next();
        return;
      }
      const isSharePage = req.path.startsWith("/share/");
      if (req.path !== "/" && !isSharePage) {
        next();
        return;
      }
      if (isSharePage) {
        res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      }
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.sendFile(path2.join(config.webDist, "index.html"), (error) => {
        if (error) next(error);
      });
    });
  }
  app.use((_req, res) => {
    res.status(404).type("text/plain").send("Not found.");
  });
  app.use(errorHandler);
  return app;
}
export {
  createApp
};
