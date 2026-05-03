import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { storesTable, ordersTable, productsTable } from "@workspace/db";
import { eq, and, desc, sql, gte } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
}

async function getStoreId(userId: string): Promise<number | null> {
  const [store] = await db
    .select({ id: storesTable.id })
    .from(storesTable)
    .where(eq(storesTable.userId, userId));
  return store?.id ?? null;
}

// GET /analytics/summary
router.get("/analytics/summary", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [orderStats] = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${ordersTable.total} AS DECIMAL)), 0)`,
        totalOrders: sql<number>`COUNT(*)`,
        pendingOrders: sql<number>`COUNT(*) FILTER (WHERE ${ordersTable.status} = 'pending')`,
        completedOrders: sql<number>`COUNT(*) FILTER (WHERE ${ordersTable.status} = 'completed')`,
        revenueThisMonth: sql<number>`COALESCE(SUM(CAST(${ordersTable.total} AS DECIMAL)) FILTER (WHERE ${ordersTable.createdAt} >= ${startOfMonth}), 0)`,
        ordersThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${ordersTable.createdAt} >= ${startOfMonth})`,
      })
      .from(ordersTable)
      .where(eq(ordersTable.storeId, storeId));

    const [productStats] = await db
      .select({
        totalProducts: sql<number>`COUNT(*)`,
        activeProducts: sql<number>`COUNT(*) FILTER (WHERE ${productsTable.isActive} = true)`,
      })
      .from(productsTable)
      .where(eq(productsTable.storeId, storeId));

    res.json({
      totalRevenue: Number(orderStats?.totalRevenue ?? 0),
      totalOrders: Number(orderStats?.totalOrders ?? 0),
      pendingOrders: Number(orderStats?.pendingOrders ?? 0),
      completedOrders: Number(orderStats?.completedOrders ?? 0),
      revenueThisMonth: Number(orderStats?.revenueThisMonth ?? 0),
      ordersThisMonth: Number(orderStats?.ordersThisMonth ?? 0),
      totalProducts: Number(productStats?.totalProducts ?? 0),
      activeProducts: Number(productStats?.activeProducts ?? 0),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /analytics/recent-orders
router.get("/analytics/recent-orders", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const limit = parseInt(req.query.limit as string) || 10;
    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.storeId, storeId))
      .orderBy(desc(ordersTable.createdAt))
      .limit(limit);

    res.json(orders);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /analytics/top-products
router.get("/analytics/top-products", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const limit = parseInt(req.query.limit as string) || 5;
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.storeId, storeId));

    const productCounts: Record<number, { id: number; name: string; price: number; imageUrl?: string | null; category?: string | null; orderCount: number; totalRevenue: number }> = {};

    for (const order of orders) {
      const items = order.items as any[];
      for (const item of items) {
        if (!productCounts[item.productId]) {
          productCounts[item.productId] = { id: item.productId, name: item.productName, price: item.price, imageUrl: null, category: null, orderCount: 0, totalRevenue: 0 };
        }
        productCounts[item.productId].orderCount += item.quantity;
        productCounts[item.productId].totalRevenue += item.price * item.quantity;
      }
    }

    const topProducts = Object.values(productCounts).sort((a, b) => b.orderCount - a.orderCount).slice(0, limit);

    if (topProducts.length > 0) {
      const productIds = topProducts.map((p) => p.id);
      const products = await db.select().from(productsTable).where(sql`${productsTable.id} = ANY(${productIds})`);
      for (const p of topProducts) {
        const found = products.find((pr) => pr.id === p.id);
        if (found) { p.imageUrl = found.imageUrl; p.category = found.category; }
      }
    }

    res.json(topProducts);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /analytics/orders-per-day
router.get("/analytics/orders-per-day", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const rows = await db
      .select({
        date: sql<string>`DATE(${ordersTable.createdAt})::text`,
        orders: sql<number>`COUNT(*)`,
        revenue: sql<number>`COALESCE(SUM(CAST(${ordersTable.total} AS DECIMAL)), 0)`,
      })
      .from(ordersTable)
      .where(and(eq(ordersTable.storeId, storeId), gte(ordersTable.createdAt, thirtyDaysAgo)))
      .groupBy(sql`DATE(${ordersTable.createdAt})`)
      .orderBy(sql`DATE(${ordersTable.createdAt})`);

    // Fill in missing days with 0
    const dataMap = new Map(rows.map(r => [r.date, r]));
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const row = dataMap.get(dateStr);
      result.push({ date: dateStr, orders: Number(row?.orders ?? 0), revenue: Number(row?.revenue ?? 0) });
    }

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /analytics/product-velocity
router.get("/analytics/product-velocity", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    // Build the date axis (oldest → newest)
    const dates: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const orders = await db
      .select({ items: ordersTable.items, createdAt: ordersTable.createdAt })
      .from(ordersTable)
      .where(and(eq(ordersTable.storeId, storeId), gte(ordersTable.createdAt, fourteenDaysAgo)));

    // Tally per-product per-day
    const velocity: Record<number, Record<string, number>> = {};

    for (const order of orders) {
      const dateStr = order.createdAt.toISOString().slice(0, 10);
      for (const item of (order.items as any[])) {
        const pid: number = item.productId;
        if (!velocity[pid]) velocity[pid] = {};
        velocity[pid][dateStr] = (velocity[pid][dateStr] ?? 0) + (item.quantity ?? 1);
      }
    }

    const result = Object.entries(velocity).map(([productId, dayCounts]) => ({
      productId: Number(productId),
      counts: dates.map(d => dayCounts[d] ?? 0),
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
