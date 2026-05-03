import type { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const log = (req as any).log ?? logger;
  log.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
};
