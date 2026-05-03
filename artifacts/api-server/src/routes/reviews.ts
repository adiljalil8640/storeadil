import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable, ordersTable, reviewsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// POST /reviews — public, submit a product review using order tracking token
router.post("/reviews", async (req: any, res) => {
  const { trackingToken, productId, rating, comment } = req.body ?? {};

  if (!trackingToken || !productId || typeof rating !== "number") {
    return res.status(400).json({ error: "trackingToken, productId, and rating are required" });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "rating must be an integer between 1 and 5" });
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(String(trackingToken))) {
    return res.status(404).json({ error: "Order not found" });
  }

  try {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.trackingToken, trackingToken));

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "completed") {
      return res.status(400).json({ error: "Reviews can only be left for completed orders" });
    }

    const items = (order.items as any[]) ?? [];
    const inOrder = items.some((item: any) => Number(item.productId) === Number(productId));
    if (!inOrder) {
      return res.status(400).json({ error: "Product was not part of this order" });
    }

    const [review] = await db
      .insert(reviewsTable)
      .values({
        storeId: order.storeId,
        orderId: order.id,
        productId: Number(productId),
        customerName: order.customerName ?? null,
        rating,
        comment: comment?.trim() || null,
      })
      .returning();

    return res.status(201).json(review);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "You have already reviewed this product" });
    }
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /stores/:slug/reviews — public, get reviews for all products in a store
router.get("/stores/:slug/reviews", async (req: any, res) => {
  try {
    const { slug } = req.params;
    const productIdParam = req.query.productId ? parseInt(req.query.productId as string) : undefined;

    const [store] = await db
      .select({ id: storesTable.id })
      .from(storesTable)
      .where(eq(storesTable.slug, slug));

    if (!store) return res.status(404).json({ error: "Store not found" });

    const conditions: any[] = [eq(reviewsTable.storeId, store.id)];
    if (productIdParam) conditions.push(eq(reviewsTable.productId, productIdParam));

    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(and(...conditions))
      .orderBy(reviewsTable.createdAt);

    return res.json(reviews);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
