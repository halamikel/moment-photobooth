import type { Request, RequestHandler } from "express";
import { getSessionById } from "../db/repository.js";
import type { SessionRecord } from "../db/repository.js";
import { HttpError, parsePositiveInt } from "../utils/http.js";
import { hashToken, isWellFormedToken, tokenHashesMatch } from "../utils/tokens.js";

const sessionByRequest = new WeakMap<Request, SessionRecord>();

export const requireSessionAccess: RequestHandler = (req, _res, next) => {
  try {
    const authorization = req.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (!isWellFormedToken(token)) {
      throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
    }

    const sessionId = parsePositiveInt(req.params.id, "session id");
    const session = getSessionById(sessionId);
    if (!session) {
      throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
    }

    if (!tokenHashesMatch(session.accessTokenHash, hashToken(token))) {
      throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
    }

    if (Date.parse(session.expiresAt) <= Date.now()) {
      throw new HttpError(401, "SESSION_EXPIRED", "This photo session has expired.");
    }

    sessionByRequest.set(req, session);
    next();
  } catch (error) {
    next(error);
  }
};

export function authenticatedSession(req: Request): SessionRecord {
  const session = sessionByRequest.get(req);
  if (!session) {
    throw new HttpError(401, "UNAUTHORIZED", "A valid session token is required.");
  }
  return session;
}
