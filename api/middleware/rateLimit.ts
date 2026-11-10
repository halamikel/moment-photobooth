import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";

function createLimiter(options: {
  windowMs: number;
  limit: number;
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: "Too many requests. Please wait a moment and try again.",
      });
    },
  });
}

export const apiLimiter = createLimiter({ windowMs: 15 * 60 * 1000, limit: 600 });
export const sessionCreateLimiter = createLimiter({ windowMs: 10 * 60 * 1000, limit: 20 });
export const uploadLimiter = createLimiter({ windowMs: 60 * 1000, limit: 10 });
export const shareCreateLimiter = createLimiter({ windowMs: 60 * 1000, limit: 10 });
export const downloadLimiter = createLimiter({ windowMs: 60 * 1000, limit: 120 });
