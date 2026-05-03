import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { checkDb, getPoolStats } from "../lib/health";
import { storesTable, ordersTable, plansTable, subscriptionsTable, usageTrackingTable, aiProvidersTable } from "@workspace/db";
import { eq, sql, count, desc, and } from "drizzle-orm";
import { getPlanByName } from "../services/billing";
import { getCurrentMonth } from "../services/usage";
import OpenAI from "openai";

const router = Router();

// Tight rate limit — admin routes are low-volume by nature
router.use(rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many admin requests. Please slow down." },
}));

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);

function requireAdmin(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  // If ADMIN_USER_IDS is not configured, deny everyone — no silent open access.
  if (ADMIN_USER_IDS.length === 0 || !ADMIN_USER_IDS.includes(userId)) {
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
    for (const row of planRows) planBreakdown[row.planName] = Number(row.cnt);

    res.json({
      totalUsers: Number(totalUsers),
      totalStores: Number(totalStores),
      totalOrders: Number(totalOrders),
      totalRevenue: Number(totalRevenue),
      planBreakdown,
    });
  } catch (err) {
    throw err;
  }
});

// GET /admin/users
router.get("/admin/users", requireAdmin, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

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
    throw err;
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

    res.json({
      userId,
      storeName: store?.name ?? null,
      storeSlug: store?.slug ?? null,
      planName: plan.name,
      planDisplayName: plan.displayName,
      subscriptionStatus: "active",
      ordersThisMonth: 0,
      totalOrders: 0,
      createdAt: new Date(),
    });
  } catch (err) {
    throw err;
  }
});

// ─── AI Provider Management ───────────────────────────────────────────────────

// GET /admin/ai-providers
router.get("/admin/ai-providers", requireAdmin, async (req: any, res) => {
  try {
    const providers = await db.select().from(aiProvidersTable).orderBy(desc(aiProvidersTable.isDefault), aiProvidersTable.createdAt);
    res.json(providers);
  } catch (err) {
    throw err;
  }
});

// POST /admin/ai-providers
router.post("/admin/ai-providers", requireAdmin, async (req: any, res) => {
  const { name, provider, baseUrl, apiKey, defaultModel, isActive } = req.body;

  if (!name || !provider || !baseUrl || !apiKey || !defaultModel) {
    return res.status(400).json({ error: "name, provider, baseUrl, apiKey, defaultModel are required" });
  }

  try {
    const [created] = await db
      .insert(aiProvidersTable)
      .values({ name, provider, baseUrl, apiKey, defaultModel, isActive: isActive !== false, isDefault: false })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    throw err;
  }
});

// PUT /admin/ai-providers/:id
router.put("/admin/ai-providers/:id", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const { name, provider, baseUrl, apiKey, defaultModel, isActive } = req.body;
  if (!name || !provider || !baseUrl || !apiKey || !defaultModel) {
    return res.status(400).json({ error: "name, provider, baseUrl, apiKey, defaultModel are required" });
  }

  try {
    const [updated] = await db
      .update(aiProvidersTable)
      .set({ name, provider, baseUrl, apiKey, defaultModel, isActive: isActive !== false, updatedAt: new Date() })
      .where(eq(aiProvidersTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Provider not found" });
    res.json(updated);
  } catch (err) {
    throw err;
  }
});

// DELETE /admin/ai-providers/:id
router.delete("/admin/ai-providers/:id", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  try {
    await db.delete(aiProvidersTable).where(eq(aiProvidersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    throw err;
  }
});

// PATCH /admin/ai-providers/:id/default
router.patch("/admin/ai-providers/:id/default", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  try {
    await db.update(aiProvidersTable).set({ isDefault: false, updatedAt: new Date() });
    const [updated] = await db
      .update(aiProvidersTable)
      .set({ isDefault: true, isActive: true, updatedAt: new Date() })
      .where(eq(aiProvidersTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Provider not found" });
    res.json(updated);
  } catch (err) {
    throw err;
  }
});

// POST /admin/ai-providers/test
router.post("/admin/ai-providers/test", requireAdmin, async (req: any, res) => {
  const { baseUrl, apiKey, defaultModel } = req.body;
  if (!baseUrl || !apiKey || !defaultModel) {
    return res.status(400).json({ error: "baseUrl, apiKey, defaultModel are required" });
  }

  try {
    const client = new OpenAI({ baseURL: baseUrl, apiKey });
    const completion = await client.chat.completions.create({
      model: defaultModel,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
      max_tokens: 10,
    });
    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ success: true, message: `Connected — model replied: "${reply}"`, model: defaultModel });
  } catch (err: any) {
    res.json({ success: false, message: err?.message ?? "Connection failed" });
  }
});

// GET /admin/health — DB liveness + connection pool stats
router.get("/admin/health", requireAdmin, async (_req, res) => {
  const db = await checkDb();
  const pool = getPoolStats();
  const status = db === "ok" ? "ok" : "degraded";
  res.status(db === "ok" ? 200 : 503).json({ status, db, pool });
});

export default router;
