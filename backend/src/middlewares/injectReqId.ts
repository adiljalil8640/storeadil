import type { RequestHandler } from "express";

export const injectReqId: RequestHandler = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (body: unknown) {
    if (
      res.statusCode >= 400 &&
      body !== null &&
      typeof body === "object" &&
      !Array.isArray(body)
    ) {
      (body as Record<string, unknown>).reqId = req.id;
    }
    return originalJson(body);
  };

  next();
};
