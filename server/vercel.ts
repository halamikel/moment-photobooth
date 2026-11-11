import type { Express } from "express";

declare const require: (id: string) => { createApp: () => Express };
declare const module: { exports: unknown };

let app: Express | null = null;
let startupError: unknown = null;

try {
  app = require("./app.js").createApp();
} catch (error) {
  startupError = error;
}

function handler(req: any, res: any): void {
  if (!app) {
    const detail =
      startupError instanceof Error
        ? `${startupError.name}: ${startupError.message}`
        : String(startupError);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "API failed to start.", detail }));
    return;
  }

  app(req, res);
}

module.exports = handler;
