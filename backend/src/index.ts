import app from "./app";
import { logger } from "./lib/logger";
import { startDigestScheduler } from "./services/digest";
import * as http from "node:http";
import * as net from "node:net";

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

// In development, proxy WebSocket upgrade requests (Vite HMR) to the Vite dev server
if (process.env.NODE_ENV === "development") {
  const VITE_PORT = parseInt(process.env.VITE_PORT ?? "18973", 10);

  server.on("upgrade", (req, socket, head) => {
    const viteSocket = net.connect(VITE_PORT, "localhost", () => {
      // Reconstruct the HTTP upgrade request and pipe both ways
      const reqLine = `${req.method ?? "GET"} ${req.url} HTTP/1.1\r\n`;
      const headers = Object.entries(req.headers)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join("\r\n");
      viteSocket.write(`${reqLine}${headers}\r\n\r\n`);
      if (head?.length) viteSocket.write(head);
      viteSocket.pipe(socket);
      socket.pipe(viteSocket);
    });
    viteSocket.on("error", () => socket.destroy());
    socket.on("error", () => viteSocket.destroy());
  });
}

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
