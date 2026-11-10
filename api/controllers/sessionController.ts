import type { Request, Response } from "express";
import { z } from "zod";
import {
  FRAME_IDS,
  LAYOUT_IDS,
  type CreateSessionResponse,
  type CreateShareResponse,
  type FinalizeResponse,
  type SessionResponse,
  type SessionSummary,
} from "../../shared/contracts.js";
import { config } from "../config.js";
import {
  createSession,
  getMediaForSession,
  getSessionById,
  listMediaBySession,
  type SessionRecord,
} from "../db/repository.js";
import { authenticatedSession } from "../middleware/auth.js";
import { finalizeSessionMedia } from "../services/finalizeService.js";
import {
  sendStoredMedia,
  toOwnerMediaSummary,
} from "../services/mediaService.js";
import { createShareForSession } from "../services/shareService.js";
import { HttpError, parsePositiveInt, sanitizePlainText } from "../utils/http.js";
import { createOpaqueToken, hashToken } from "../utils/tokens.js";

const createSessionSchema = z
  .object({
    layout: z.enum(LAYOUT_IDS),
    frame: z.enum(FRAME_IDS),
    caption: z.string().max(200).optional().default(""),
  })
  .strict();

type UploadedFiles = Record<string, Express.Multer.File[]> | undefined;

function toSessionSummary(session: SessionRecord): SessionSummary {
  return {
    id: session.id,
    layout: session.layout,
    frame: session.frame,
    caption: session.caption,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    finalizedAt: session.finalizedAt,
  };
}

export async function createSessionHandler(req: Request, res: Response): Promise<void> {
  const body = createSessionSchema.parse(req.body);
  const caption = sanitizePlainText(body.caption);
  const accessToken = createOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionTtlMs).toISOString();

  const session = createSession({
    accessTokenHash: hashToken(accessToken),
    layout: body.layout,
    frame: body.frame,
    caption: caption.length > 0 ? caption : null,
    createdAt: now.toISOString(),
    expiresAt,
  });

  const response: CreateSessionResponse = {
    session: toSessionSummary(session),
    accessToken,
  };

  res.status(201).json(response);
}

export async function getSessionHandler(req: Request, res: Response): Promise<void> {
  const session = authenticatedSession(req);
  const media = listMediaBySession(session.id).map((item) =>
    toOwnerMediaSummary(item, session.id),
  );

  const response: SessionResponse = {
    session: toSessionSummary(session),
    media,
  };

  res.json(response);
}

export async function finalizeSessionHandler(req: Request, res: Response): Promise<void> {
  const session = authenticatedSession(req);
  const files = req.files as UploadedFiles;
  const result = await finalizeSessionMedia(session, files);
  const updated = getSessionById(session.id);

  if (!updated) {
    throw new HttpError(500, "SESSION_MISSING", "The photo session could not be loaded.");
  }

  const response: FinalizeResponse = {
    session: toSessionSummary(updated),
    media: result.media.map((item) => toOwnerMediaSummary(item, updated.id)),
    message: "Your photo strip is ready.",
  };

  res.status(201).json(response);
}

export async function createShareHandler(req: Request, res: Response): Promise<void> {
  const session = authenticatedSession(req);
  const share = createShareForSession(session);

  const response: CreateShareResponse = {
    token: share.token,
    expiresAt: share.expiresAt,
    path: `/share/${share.token}`,
  };

  res.status(201).json(response);
}

export async function getOwnerMediaHandler(req: Request, res: Response): Promise<void> {
  const session = authenticatedSession(req);
  const mediaId = parsePositiveInt(req.params.mediaId, "media id");
  const media = getMediaForSession(mediaId, session.id);

  if (!media) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }

  await sendStoredMedia(res, media, req.query.download === "1");
}
