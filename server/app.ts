import fs from "node:fs";
import path from "node:path";
import express from "express";
import { config } from "./config.js";
import { ensureDatabaseSchema } from "./db/database.js";
import { bearerTokenFromHeader } from "./middleware/auth.js";
import { apiNotFound, errorHandler } from "./middleware/errors.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { permissionsPolicy, securityHeaders } from "./middleware/security.js";
import { blobRoutes } from "./routes/blobRoutes.js";
import { sessionRoutes } from "./routes/sessionRoutes.js";
import { shareRoutes } from "./routes/shareRoutes.js";
import { cleanupExpiredData } from "./services/cleanupService.js";
import { HttpError, noStore } from "./utils/http.js";

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function databaseHost(): string {
  try {
    const hostname = new URL(config.databaseUrl).hostname;
    return hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
      ? "local"
      : "remote";
  } catch {
    return "invalid";
  }
}

function databaseSource(): string {
  if (process.env.DATABASE_URL) return "DATABASE_URL";
  if (process.env.POSTGRES_URL) return "POSTGRES_URL";
  if (process.env.DATABASE_URL_UNPOOLED) return "DATABASE_URL_UNPOOLED";
  if (process.env.POSTGRES_PRISMA_URL) return "POSTGRES_PRISMA_URL";
  return "default";
}

function describeDatabaseError(error: unknown): {
  code?: string;
  name: string;
} {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  return {
    ...(typeof code === "string" ? { code } : {}),
    name: error instanceof Error ? error.name : "Error",
  };
}

export function createApp(): express.Express {
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
      type: "application/json",
    }),
  );

  app.get("/api/health", noStore, async (req, res) => {
    if (req.query.db !== "1") {
      res.json({ status: "ok" });
      return;
    }

    try {
      await ensureDatabaseSchema();
      res.json({
        status: "ok",
        database: "ok",
        host: databaseHost(),
        source: databaseSource(),
      });
    } catch (error) {
      res.status(503).json({
        status: "degraded",
        database: "unavailable",
        host: databaseHost(),
        source: databaseSource(),
        ...describeDatabaseError(error),
      });
    }
  });

  app.use("/api", noStore, (_req, _res, next) => {
    ensureDatabaseSchema().then(() => next(), next);
  });

  app.get("/api/cron/cleanup", async (req, res, next) => {
    try {
      if (config.cronSecret) {
        const token = bearerTokenFromHeader(req.get("authorization"));
        if (!token || !timingSafeEqual(token, config.cronSecret)) {
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
      express.static(path.join(config.webDist, "assets"), {
        index: false,
        dotfiles: "deny",
        maxAge: "1y",
        immutable: true,
      }),
    );

    app.use(
      express.static(config.webDist, {
        index: false,
        dotfiles: "deny",
        maxAge: 0,
      }),
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
      res.sendFile(path.join(config.webDist, "index.html"), (error) => {
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
