import type { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const r = req as any;
  const log = r.log ?? logger;
  const responseTimeMs = r.startedAt != null ? Date.now() - r.startedAt : undefined;

  log.error(
    {
      err,
      userId: r.userId ?? undefined,
      storeId: r.storeId ?? undefined,
      status: 500,
      responseTimeMs,
    },
    "Unhandled route error",
  );

  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
};
