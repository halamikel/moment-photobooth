import fs from "node:fs";
import path from "node:path";
import express from "express";
import { config } from "./config.js";
import { apiNotFound, errorHandler } from "./middleware/errors.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { permissionsPolicy, securityHeaders } from "./middleware/security.js";
import { sessionRoutes } from "./routes/sessionRoutes.js";
import { shareRoutes } from "./routes/shareRoutes.js";
import { noStore } from "./utils/http.js";

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

  app.use("/api", noStore, apiLimiter);
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
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
