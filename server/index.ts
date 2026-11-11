import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase, ensureDatabaseSchema } from "./db/database.js";
import { startCleanupJob } from "./services/cleanupService.js";

async function main(): Promise<void> {
  await ensureDatabaseSchema();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`MOMENT API listening on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    startCleanupJob();
  });

  function shutdown(signal: string): void {
    console.log(`Received ${signal}. Closing MOMENT API.`);
    server.close(() => {
      void closeDatabase().finally(() => process.exit(0));
    });

    setTimeout(() => {
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main().catch((error: unknown) => {
  console.error("MOMENT API failed to start.", error);
  process.exit(1);
});
