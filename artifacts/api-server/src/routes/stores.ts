import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateStoreBody, UpdateMyStoreBody } from "@workspace/api-zod";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
}

// GET /stores/me
router.get("/stores/me", requireAuth, async (req: any, res) => {
  try {
    const [store] = await db
      .select()
      .from(storesTable)
      .where(eq(storesTable.userId, req.userId));
    if (!store) return res.status(404).json({ error: "No store found" });
    res.json(store);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /stores/me
router.put("/stores/me", requireAuth, async (req: any, res) => {
  const parsed = UpdateMyStoreBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const [store] = await db
      .update(storesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(storesTable.userId, req.userId))
      .returning();
    if (!store) return res.status(404).json({ error: "No store found" });
    res.json(store);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /stores
router.post("/stores", requireAuth, async (req: any, res) => {
  const parsed = CreateStoreBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const [store] = await db
      .insert(storesTable)
      .values({ ...parsed.data, userId: req.userId })
      .returning();
    res.status(201).json(store);
  } catch (err: any) {
    req.log.error(err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Store slug already taken" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /stores/public/:slug
router.get("/stores/public/:slug", async (req: any, res) => {
  try {
    const { productsTable } = await import("@workspace/db");
    const [store] = await db
      .select()
      .from(storesTable)
      .where(eq(storesTable.slug, req.params.slug));
    if (!store) return res.status(404).json({ error: "Store not found" });

    const products = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.storeId, store.id));

    res.json({ ...store, products });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
