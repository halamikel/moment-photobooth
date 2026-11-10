import type { RequestHandler } from "express";
import helmet from "helmet";
import { config } from "../config.js";

const cspDirectives: Record<string, string[] | null> = {
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
  connectSrc: ["'self'"],
  workerSrc: ["'self'", "blob:"],
  manifestSrc: ["'self'"],
  frameSrc: ["'none'"],
};

if (config.isProduction) {
  cspDirectives.upgradeInsecureRequests = [];
}

export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: cspDirectives,
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "same-origin" },
  referrerPolicy: { policy: "no-referrer" },
  frameguard: { action: "deny" },
  noSniff: true,
  hsts: config.isProduction
    ? {
        maxAge: 15552000,
        includeSubDomains: true,
        preload: true,
      }
    : false,
});

export const permissionsPolicy: RequestHandler = (_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  );
  next();
};
