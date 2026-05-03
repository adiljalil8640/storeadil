import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { storesTable, ordersTable, productsTable, couponsTable } from "@workspace/db";
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

// GET /analytics/order-heatmap
router.get("/analytics/order-heatmap", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const rows = await db
      .select({
        dayOfWeek: sql<number>`EXTRACT(DOW FROM ${ordersTable.createdAt})::int`,
        hour: sql<number>`EXTRACT(HOUR FROM ${ordersTable.createdAt})::int`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(ordersTable)
      .where(eq(ordersTable.storeId, storeId))
      .groupBy(
        sql`EXTRACT(DOW FROM ${ordersTable.createdAt})`,
        sql`EXTRACT(HOUR FROM ${ordersTable.createdAt})`
      );

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /analytics/customer-insights
router.get("/analytics/customer-insights", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const orders = await db
      .select({
        customerName: ordersTable.customerName,
        customerEmail: ordersTable.customerEmail,
        customerPhone: ordersTable.customerPhone,
        total: ordersTable.total,
      })
      .from(ordersTable)
      .where(eq(ordersTable.storeId, storeId));

    // Group by best identifier: email > phone > name > "__guest__"
    const map: Record<string, {
      name: string | null; email: string | null; phone: string | null;
      orderCount: number; totalSpend: number;
    }> = {};

    for (const order of orders) {
      const key = order.customerEmail?.trim().toLowerCase()
        ?? order.customerPhone?.trim()
        ?? order.customerName?.trim()
        ?? "__guest__";

      if (!map[key]) {
        map[key] = { name: order.customerName ?? null, email: order.customerEmail ?? null, phone: order.customerPhone ?? null, orderCount: 0, totalSpend: 0 };
      }
      map[key].orderCount += 1;
      map[key].totalSpend += Number(order.total);
      if (!map[key].name && order.customerName) map[key].name = order.customerName;
      if (!map[key].email && order.customerEmail) map[key].email = order.customerEmail;
      if (!map[key].phone && order.customerPhone) map[key].phone = order.customerPhone;
    }

    const customers = Object.values(map);
    const newCustomers       = customers.filter(c => c.orderCount === 1).length;
    const returningCustomers = customers.filter(c => c.orderCount >= 2).length;
    const totalUniqueCustomers = customers.length;
    const avgOrderFrequency = totalUniqueCustomers > 0
      ? Math.round((orders.length / totalUniqueCustomers) * 10) / 10
      : 0;

    const topCustomers = customers
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 8)
      .map(c => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        orderCount: c.orderCount,
        totalSpend: Math.round(c.totalSpend * 100) / 100,
        avgOrderValue: c.orderCount > 0 ? Math.round((c.totalSpend / c.orderCount) * 100) / 100 : 0,
      }));

    res.json({ newCustomers, returningCustomers, totalUniqueCustomers, avgOrderFrequency, topCustomers });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /analytics/top-customers
router.get("/analytics/top-customers", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const limit = Math.min(parseInt(req.query.limit as string) || 8, 20);

    const orders = await db
      .select({
        customerName: ordersTable.customerName,
        customerEmail: ordersTable.customerEmail,
        customerPhone: ordersTable.customerPhone,
        total: ordersTable.total,
      })
      .from(ordersTable)
      .where(eq(ordersTable.storeId, storeId));

    // Group by best available identifier: email > phone > name > "Guest"
    const map: Record<string, {
      key: string; name: string | null; email: string | null;
      phone: string | null; orderCount: number; totalSpend: number;
    }> = {};

    for (const order of orders) {
      const key = order.customerEmail?.trim().toLowerCase()
        ?? order.customerPhone?.trim()
        ?? order.customerName?.trim()
        ?? "__guest__";

      if (!map[key]) {
        map[key] = {
          key,
          name: order.customerName ?? null,
          email: order.customerEmail ?? null,
          phone: order.customerPhone ?? null,
          orderCount: 0,
          totalSpend: 0,
        };
      }
      map[key].orderCount += 1;
      map[key].totalSpend += Number(order.total);

      // Prefer the most-informative name we've seen
      if (!map[key].name && order.customerName) map[key].name = order.customerName;
      if (!map[key].email && order.customerEmail) map[key].email = order.customerEmail;
      if (!map[key].phone && order.customerPhone) map[key].phone = order.customerPhone;
    }

    const result = Object.values(map)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, limit);

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

// GET /analytics/coupon-performance
router.get("/analytics/coupon-performance", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const coupons = await db
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.storeId, storeId))
      .orderBy(desc(couponsTable.usedCount));

    const result = coupons.map((c) => {
      const usedCount = c.usedCount ?? 0;
      const value = Number(c.value ?? 0);
      const estimatedDiscount = c.type === "fixed" ? value * usedCount : null;
      const now = new Date();
      const expired = c.expiresAt != null && c.expiresAt < now;
      const maxedOut = c.maxUses != null && usedCount >= c.maxUses;
      return {
        id: c.id,
        code: c.code,
        type: c.type,
        value,
        minOrderAmount: c.minOrderAmount != null ? Number(c.minOrderAmount) : null,
        maxUses: c.maxUses,
        usedCount,
        estimatedDiscount,
        isActive: c.isActive,
        expired,
        maxedOut,
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /analytics/revenue-trend
router.get("/analytics/revenue-trend", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const days = 7;
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    const rows = await db
      .select({
        date: sql<string>`TO_CHAR(DATE_TRUNC('day', ${ordersTable.createdAt}), 'YYYY-MM-DD')`,
        revenue: sql<number>`COALESCE(SUM(CAST(${ordersTable.total} AS DECIMAL)), 0)`,
      })
      .from(ordersTable)
      .where(and(eq(ordersTable.storeId, storeId), gte(ordersTable.createdAt, since)))
      .groupBy(sql`DATE_TRUNC('day', ${ordersTable.createdAt})`)
      .orderBy(sql`DATE_TRUNC('day', ${ordersTable.createdAt})`);

    const map = new Map(rows.map((r) => [r.date, Number(r.revenue)]));
    const result: { date: string; revenue: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, revenue: map.get(key) ?? 0 });
    }

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /analytics/revenue-by-day
router.get("/analytics/revenue-by-day", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const rows = await db
      .select({
        dayOfWeek: sql<number>`EXTRACT(DOW FROM ${ordersTable.createdAt})::int`,
        revenue: sql<number>`COALESCE(SUM(CAST(${ordersTable.total} AS DECIMAL)), 0)`,
        orderCount: sql<number>`COUNT(*)::int`,
      })
      .from(ordersTable)
      .where(eq(ordersTable.storeId, storeId))
      .groupBy(sql`EXTRACT(DOW FROM ${ordersTable.createdAt})`)
      .orderBy(sql`EXTRACT(DOW FROM ${ordersTable.createdAt})`);

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const map = new Map(
      rows.map((r) => [r.dayOfWeek, { revenue: Number(r.revenue), orderCount: Number(r.orderCount) }])
    );

    // Return Mon → Sun order
    const result = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
      dayOfWeek: dow,
      day: DAY_NAMES[dow],
      revenue: map.get(dow)?.revenue ?? 0,
      orderCount: map.get(dow)?.orderCount ?? 0,
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
