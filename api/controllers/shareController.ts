import type { Request, Response } from "express";
import type { ShareResponse } from "../../shared/contracts.js";
import { getMediaForSession } from "../db/repository.js";
import { sendStoredMedia, toShareMediaSummary } from "../services/mediaService.js";
import { resolveShareToken } from "../services/shareService.js";
import { HttpError, parsePositiveInt } from "../utils/http.js";

export async function getShareHandler(req: Request, res: Response): Promise<void> {
  const { token, lookup, media } = resolveShareToken(req.params.token);

  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  const response: ShareResponse = {
    layout: lookup.session.layout,
    frame: lookup.session.frame,
    caption: lookup.session.caption,
    createdAt: lookup.session.createdAt,
    expiresAt: lookup.share.expiresAt,
    media: media.map((item) => toShareMediaSummary(item, token)),
  };

  res.json(response);
}

export async function getShareMediaHandler(req: Request, res: Response): Promise<void> {
  const { lookup } = resolveShareToken(req.params.token);
  const mediaId = parsePositiveInt(req.params.mediaId, "media id");
  const media = getMediaForSession(mediaId, lookup.session.id);

  if (!media) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "That media file is unavailable.");
  }

  await sendStoredMedia(res, media, req.query.download === "1");
}
