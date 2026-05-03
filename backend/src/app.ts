import { execSync } from "child_process";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./api-routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middlewares/errorHandler";
import { injectReqId } from "./middlewares/injectReqId";
import { seedPlans } from "./services/billing";
import { HealthCheckResponse } from "@workspace/api-zod";
import { checkDb } from "./lib/health";

const COMMIT_SHA = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
})();

const app: Express = express();

// Trust the reverse proxy (Replit's routing layer) so that X-Forwarded-For
// is used for rate limiting and Clerk's IP detection instead of the internal IP.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(injectReqId);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
// In production, only allow origins listed in ALLOWED_ORIGINS.
// In development, all origins are permitted so the Vite dev server works freely.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  credentials: true,
  origin: (origin, cb) => {
    // No Origin header = same-origin, curl, mobile — always allow
    if (!origin) return cb(null, true);
    // Dev: allow everything
    if (process.env.NODE_ENV !== "production") return cb(null, true);
    // Prod: require an explicit allowlist
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0) {
      logger.warn({ origin }, "CORS: ALLOWED_ORIGINS is not set — blocked request in production");
    }
    return cb(new Error(`CORS: ${origin} is not in the allowlist`), false);
  },
}));

// Health check and version — registered before Clerk so they are always reachable
app.get("/api/healthz", async (_req, res) => {
  const db = await checkDb();
  const status = db === "ok" ? "ok" : "degraded";
  const body = HealthCheckResponse.parse({ status });
  res.status(db === "ok" ? 200 : 503).json({ ...body, db });
});

app.get("/api/version", async (_req, res) => {
  const db = await checkDb();
  res.json({ commit: COMMIT_SHA, env: process.env.NODE_ENV ?? "unknown", db });
});

// In development, forward non-API requests to the Vite dev server
if (process.env.NODE_ENV === "development") {
  const http = await import("node:http");
  const VITE_PORT = parseInt(process.env.VITE_PORT ?? "18973", 10);

  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    const proxyReq = http.request(
      {
        hostname: "localhost",
        port: VITE_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${VITE_PORT}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      },
    );
    proxyReq.on("error", () => res.status(502).send("Vite dev server unreachable"));
    req.pipe(proxyReq, { end: true });
  });
}

// Raw body for Stripe webhooks
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// The CLERK_SECRET_KEY may belong to a different Clerk instance than VITE_CLERK_PUBLISHABLE_KEY.
// To decouple JWT verification from the secret key's JWKS, we supply the RSA public key
// (fetched from the FAPI's /.well-known/jwks.json) directly as jwtKey.
// This ensures tokens issued by the pk_test_ instance are verified with the correct key,
// regardless of which Clerk instance the sk_test_ belongs to.
const CLERK_JWT_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwIsShJgN2ISL4Es4yzIT
EAmsXiHYxr8STT92WNdIb8Tro5ysajGUBWFzp/pnzTw/8eTq9zcwIoEYXX0OMa+Q
V8U7nxzPHyHTfad3cqz9tKty9lTNmIspin6ulYSL7LnovRYaYAoBhmSC2iKslbNZ
I+C0P91XclZ4adxsD1OMv9QM6lXu+fBEyt4NBN8wfjOoI3rlchk5oMATFXVN4lnc
6IWUIATBZOUs/rUToeM/xEnsfX54Pn4k5PltcfwPLIOARYRgTfpB6x/fUVxLAUfC
qRmGs9hKCL9oJ/mdlzmT7NmbBEbg58AlGNPRjkvFqkOpRIqzM7SfRJe8HREVmhc1
owIDAQAB
-----END PUBLIC KEY-----`;

app.use(
  "/api",
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    jwtKey: CLERK_JWT_KEY,
  }),
);

app.use("/api", router);
app.use(errorHandler);

// Seed plans on startup
seedPlans().catch((err) => logger.error({ err }, "Failed to seed plans"));

export default app;
