import { pool } from "@workspace/db";
import { logger } from "./logger";

pool.on("error", (err, client) => {
  logger.error({ err, client: String(client) }, "Unexpected PostgreSQL pool client error");
});

export async function checkDb(): Promise<"ok" | "error"> {
  try {
    await pool.query("SELECT 1");
    return "ok";
  } catch {
    return "error";
  }
}

export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}
