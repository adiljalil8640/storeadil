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
import { pool } from "@workspace/db";

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
  let dbStatus: "ok" | "error" = "ok";
  try {
    await pool.query("SELECT 1");
  } catch {
    dbStatus = "error";
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";
  const body = HealthCheckResponse.parse({ status });
  const httpStatus = status === "ok" ? 200 : 503;
  res.status(httpStatus).json({ ...body, db: dbStatus });
});

app.get("/api/version", async (_req, res) => {
  let db: "ok" | "error" = "ok";
  try {
    await pool.query("SELECT 1");
  } catch {
    db = "error";
  }
  res.json({ commit: COMMIT_SHA, env: process.env.NODE_ENV ?? "unknown", db });
});

// Raw body for Stripe webhooks
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);
app.use(errorHandler);

// Seed plans on startup
seedPlans().catch((err) => logger.error({ err }, "Failed to seed plans"));

export default app;
