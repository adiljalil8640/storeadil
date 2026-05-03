import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { storesTable, ordersTable, plansTable, subscriptionsTable, usageTrackingTable } from "@workspace/db";
import { eq, sql, count, desc } from "drizzle-orm";
import { getPlanByName } from "../services/billing";
import { getCurrentMonth } from "../services/usage";

const router = Router();

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);

function requireAdmin(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  req.userId = userId;
  next();
}

// GET /admin/stats
router.get("/admin/stats", requireAdmin, async (req: any, res) => {
  try {
    const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(subscriptionsTable);
    const [{ totalStores }] = await db.select({ totalStores: count() }).from(storesTable);
    const [{ totalOrders }] = await db.select({ totalOrders: count() }).from(ordersTable);
    const [{ totalRevenue }] = await db
      .select({ totalRevenue: sql<number>`COALESCE(SUM(CAST(${ordersTable.total} AS DECIMAL)), 0)` })
      .from(ordersTable);

    const planRows = await db
      .select({ planName: plansTable.name, cnt: count() })
      .from(subscriptionsTable)
      .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
      .groupBy(plansTable.name);

    const planBreakdown: Record<string, number> = {};
    for (const row of planRows) {
      planBreakdown[row.planName] = Number(row.cnt);
    }

    res.json({
      totalUsers: Number(totalUsers),
      totalStores: Number(totalStores),
      totalOrders: Number(totalOrders),
      totalRevenue: Number(totalRevenue),
      planBreakdown,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/users
router.get("/admin/users", requireAdmin, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const month = getCurrentMonth();

    const rows = await db
      .select({
        userId: subscriptionsTable.userId,
        storeName: storesTable.name,
        storeSlug: storesTable.slug,
        planName: plansTable.name,
        planDisplayName: plansTable.displayName,
        subscriptionStatus: subscriptionsTable.status,
        createdAt: subscriptionsTable.createdAt,
      })
      .from(subscriptionsTable)
      .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
      .leftJoin(storesTable, eq(storesTable.userId, subscriptionsTable.userId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const results = await Promise.all(rows.map(async (row) => {
      const store = row.storeSlug
        ? await db.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.slug, row.storeSlug))
        : [];

      let totalOrders = 0;
      let ordersThisMonth = 0;

      if (store[0]) {
        const [stats] = await db
          .select({
            total: count(),
            thisMonth: sql<number>`COUNT(*) FILTER (WHERE DATE_TRUNC('month', ${ordersTable.createdAt}) = DATE_TRUNC('month', NOW()))`,
          })
          .from(ordersTable)
          .where(eq(ordersTable.storeId, store[0].id));
        totalOrders = Number(stats?.total ?? 0);
        ordersThisMonth = Number(stats?.thisMonth ?? 0);
      }

      return {
        userId: row.userId,
        storeName: row.storeName ?? null,
        storeSlug: row.storeSlug ?? null,
        planName: row.planName,
        planDisplayName: row.planDisplayName,
        subscriptionStatus: row.subscriptionStatus,
        ordersThisMonth,
        totalOrders,
        createdAt: row.createdAt,
      };
    }));

    res.json(results);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /admin/users/:userId/plan
router.patch("/admin/users/:userId/plan", requireAdmin, async (req: any, res) => {
  const { userId } = req.params;
  const { planName } = req.body;

  if (!planName || !["free", "pro", "business"].includes(planName)) {
    return res.status(400).json({ error: "Invalid plan name" });
  }

  try {
    const plan = await getPlanByName(planName);
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    await db
      .insert(subscriptionsTable)
      .values({ userId, planId: plan.id, status: "active" })
      .onConflictDoUpdate({
        target: subscriptionsTable.userId,
        set: { planId: plan.id, status: "active", updatedAt: new Date() },
      });

    const [store] = await db.select().from(storesTable).where(eq(storesTable.userId, userId));
    const totalOrders = 0;
    const ordersThisMonth = 0;

    res.json({
      userId,
      storeName: store?.name ?? null,
      storeSlug: store?.slug ?? null,
      planName: plan.name,
      planDisplayName: plan.displayName,
      subscriptionStatus: "active",
      ordersThisMonth,
      totalOrders,
      createdAt: new Date(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
