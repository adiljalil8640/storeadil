import { execSync } from "child_process";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
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
app.use(cors({ credentials: true, origin: true }));

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

app.use(
  "/api",
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
    secretKey: process.env.CLERK_SECRET_KEY,
  })),
);

app.use("/api", router);
app.use(errorHandler);

// Seed plans on startup
seedPlans().catch((err) => logger.error({ err }, "Failed to seed plans"));

export default app;
