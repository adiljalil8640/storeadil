import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface AuthedRequest extends Request {
  userId: string;
}

export interface StoreRequest extends AuthedRequest {
  storeId: number;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  logger.info({
    hasAuthHeader: !!req.headers.authorization,
    authStatus: auth?.status,
    userId: userId ?? null,
  }, "requireAuth");
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

export async function getStoreId(userId: string): Promise<number | null> {
  const [store] = await db
    .select({ id: storesTable.id })
    .from(storesTable)
    .where(eq(storesTable.userId, userId));
  return store?.id ?? null;
}

export async function getStoreOrFail(userId: string, res: Response): Promise<number | null> {
  const storeId = await getStoreId(userId);
  if (!storeId) {
    res.status(404).json({ error: "No store found" });
    return null;
  }
  return storeId;
}

export async function requireStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  const storeId = await getStoreId(userId);
  if (!storeId) {
    res.status(404).json({ error: "No store found" });
    return;
  }
  (req as StoreRequest).storeId = storeId;
  next();
}
