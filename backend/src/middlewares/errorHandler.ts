import type { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const r = req as any;
  const log = r.log ?? logger;

  log.error(
    {
      err,
      userId: r.userId ?? undefined,
      storeId: r.storeId ?? undefined,
      status: 500,
    },
    "Unhandled route error",
  );

  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
};
