import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable, ordersTable, reviewsTable, productsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { sendNewReviewNotification } from "../services/email";
import { publicStoreLimiter, publicWriteLimiter } from "../middlewares/rateLimiter";
import { requireAuth, getStoreId } from "../middlewares/auth";

const router = Router();

// GET /reviews — authenticated merchant, list all reviews for their store
router.get("/reviews", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const ratingFilter = req.query.rating ? parseInt(req.query.rating as string) : undefined;
    const conditions: any[] = [eq(reviewsTable.storeId, storeId)];
    if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
      conditions.push(eq(reviewsTable.rating, ratingFilter));
    }

    const reviews = await db
      .select({
        id: reviewsTable.id,
        orderId: reviewsTable.orderId,
        productId: reviewsTable.productId,
        productName: productsTable.name,
        customerName: reviewsTable.customerName,
        rating: reviewsTable.rating,
        comment: reviewsTable.comment,
        merchantReply: reviewsTable.merchantReply,
        repliedAt: reviewsTable.repliedAt,
        createdAt: reviewsTable.createdAt,
      })
      .from(reviewsTable)
      .leftJoin(productsTable, eq(reviewsTable.productId, productsTable.id))
      .where(and(...conditions))
      .orderBy(desc(reviewsTable.createdAt));

    return res.json(reviews);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /reviews/:id/reply — authenticated merchant, add/update/remove their reply
router.patch("/reviews/:id/reply", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid review id" });

    const { reply } = req.body ?? {};

    const [existing] = await db
      .select({ id: reviewsTable.id })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.id, id), eq(reviewsTable.storeId, storeId)));

    if (!existing) return res.status(404).json({ error: "Review not found" });

    const trimmedReply = typeof reply === "string" ? reply.trim() : null;

    const [updated] = await db
      .update(reviewsTable)
      .set({
        merchantReply: trimmedReply || null,
        repliedAt: trimmedReply ? new Date() : null,
      })
      .where(eq(reviewsTable.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /reviews — public, submit a product review using order tracking token
router.post("/reviews", publicWriteLimiter, async (req: any, res) => {
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

    // Fire-and-forget merchant notification
    (async () => {
      try {
        const [store] = await db
          .select({ name: storesTable.name, notificationEmail: storesTable.notificationEmail })
          .from(storesTable)
          .where(eq(storesTable.id, order.storeId));

        if (!store?.notificationEmail) return;

        const [product] = await db
          .select({ name: productsTable.name })
          .from(productsTable)
          .where(eq(productsTable.id, Number(productId)));

        const appBaseUrl = `${req.protocol}://${req.get("host")}`;
        await sendNewReviewNotification({
          to: store.notificationEmail,
          storeName: store.name,
          productName: product?.name ?? "Unknown product",
          customerName: order.customerName ?? null,
          rating,
          comment: comment?.trim() || null,
          appBaseUrl,
        });
      } catch {}
    })();

    return res.status(201).json(review);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "You have already reviewed this product" });
    }
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /stores/:slug/reviews — public, get all reviews for a store's products
router.get("/stores/:slug/reviews", publicStoreLimiter, async (req: any, res) => {
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
