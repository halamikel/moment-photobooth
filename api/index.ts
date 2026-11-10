import { createApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./db/database.js";
import { startCleanupJob } from "./services/cleanupService.js";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`MOMENT API listening on http://localhost:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  startCleanupJob();
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}. Closing MOMENT API.`);
  server.close(() => {
    db.close();
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
