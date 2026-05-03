import app from "./app";
import { logger } from "./lib/logger";
import { startDigestScheduler } from "./services/digest";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startDigestScheduler();
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received, draining connections");

  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
    logger.info("All connections closed, exiting cleanly");
    process.exit(0);
  });

  // Force-kill if connections don't drain within 10 s
  setTimeout(() => {
    logger.warn("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
