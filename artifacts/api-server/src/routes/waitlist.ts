import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { storesTable, productsTable, stockWaitlistTable } from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /stores/public/:slug/waitlist
router.post("/stores/public/:slug/waitlist", async (req: any, res) => {
  const { productId, email, name } = req.body ?? {};
  if (!Number.isInteger(productId) || !email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "productId (integer) and a valid email are required" });
  }

  try {
    const [store] = await db
      .select({ id: storesTable.id, slug: storesTable.slug })
      .from(storesTable)
      .where(eq(storesTable.slug, req.params.slug));
    if (!store) return res.status(404).json({ error: "Store not found" });

    const [product] = await db
      .select({ id: productsTable.id, stock: productsTable.stock })
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.storeId, store.id)));
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Already back in stock — no need to join
    if (product.stock === null || product.stock > 0) {
      return res.status(409).json({ error: "Product is already in stock" });
    }

    // Deduplicate: check if email already joined for this product (and not yet notified)
    const [existing] = await db
      .select({ id: stockWaitlistTable.id })
      .from(stockWaitlistTable)
      .where(
        and(
          eq(stockWaitlistTable.productId, productId),
          eq(stockWaitlistTable.email, email.toLowerCase()),
          isNull(stockWaitlistTable.notifiedAt)
        )
      );

    if (existing) {
      return res.status(409).json({ error: "You're already on the waitlist for this product" });
    }

    await db.insert(stockWaitlistTable).values({
      productId,
      storeId: store.id,
      email: email.toLowerCase(),
      name: name ?? null,
    });

    res.status(201).json({ message: "You're on the waitlist! We'll email you when it's back." });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
}

// GET /products/waitlist-counts — authenticated, returns { counts: { [productId]: number } }
router.get("/products/waitlist-counts", requireAuth, async (req: any, res) => {
  try {
    const [store] = await db
      .select({ id: storesTable.id })
      .from(storesTable)
      .where(eq(storesTable.userId, req.userId));

    if (!store) return res.json({ counts: {} });

    const rows = await db
      .select({
        productId: stockWaitlistTable.productId,
        count: sql<number>`count(*)::int`,
      })
      .from(stockWaitlistTable)
      .where(
        and(
          eq(stockWaitlistTable.storeId, store.id),
          isNull(stockWaitlistTable.notifiedAt)
        )
      )
      .groupBy(stockWaitlistTable.productId);

    const counts: Record<number, number> = {};
    for (const row of rows) {
      counts[row.productId] = row.count;
    }

    res.json({ counts });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
