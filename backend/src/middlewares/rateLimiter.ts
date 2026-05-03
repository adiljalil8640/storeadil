import { rateLimit, ipKeyGenerator } from "express-rate-limit";

export const publicOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many orders placed. Please try again later." },
  keyGenerator: (req) => {
    const storeId = req.body?.storeId;
    const ip = ipKeyGenerator(req);
    return storeId ? `order:${storeId}:${ip}` : `order:${ip}`;
  },
});

export const publicStoreLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

export const publicTrackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many tracking requests. Please try again shortly." },
});

export const publicWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many submissions. Please wait before trying again." },
});
