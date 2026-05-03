import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { storesTable, ordersTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
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

// GET /stores/browse — public search/browse, no auth
router.get("/stores/browse", async (req: any, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const cat = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = 12;
    const offset = (page - 1) * limit;

    const { ilike, or, count, and } = await import("drizzle-orm");

    const conditions = [];
    if (q) {
      conditions.push(
        or(
          ilike(storesTable.name, `%${q}%`),
          ilike(storesTable.description, `%${q}%`),
          ilike(storesTable.slug, `%${q}%`)
        )!
      );
    }
    if (cat) {
      conditions.push(eq(storesTable.category, cat));
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ total: count() })
      .from(storesTable)
      .where(whereClause);

    const rows = await db
      .select({
        id: storesTable.id,
        name: storesTable.name,
        slug: storesTable.slug,
        description: storesTable.description,
        logoUrl: storesTable.logoUrl,
        category: storesTable.category,
        orderCount: sql<number>`cast(count(${ordersTable.id}) as int)`,
      })
      .from(storesTable)
      .leftJoin(ordersTable, eq(ordersTable.storeId, storesTable.id))
      .where(whereClause)
      .groupBy(storesTable.id)
      .orderBy(desc(sql`count(${ordersTable.id})`), desc(storesTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      stores: rows,
      total: Number(totalRow?.total ?? 0),
      page,
      totalPages: Math.ceil(Number(totalRow?.total ?? 0) / limit),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /stores/top — public, no auth
router.get("/stores/top", async (req: any, res) => {
  try {
    const rows = await db
      .select({
        id: storesTable.id,
        name: storesTable.name,
        slug: storesTable.slug,
        description: storesTable.description,
        logoUrl: storesTable.logoUrl,
        category: storesTable.category,
        orderCount: sql<number>`cast(count(${ordersTable.id}) as int)`,
      })
      .from(storesTable)
      .leftJoin(ordersTable, eq(ordersTable.storeId, storesTable.id))
      .groupBy(storesTable.id)
      .orderBy(desc(sql`count(${ordersTable.id})`))
      .limit(6);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
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

// GET /stores/slug-check?slug=foo — check availability (auth required)
router.get("/stores/slug-check", requireAuth, async (req: any, res) => {
  const slug = typeof req.query.slug === "string" ? req.query.slug.trim().toLowerCase() : "";

  if (!slug || slug.length < 3 || slug.length > 50 || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return res.json({ available: false, slug, reason: "invalid" });
  }

  try {
    const [mine] = await db
      .select({ slug: storesTable.slug })
      .from(storesTable)
      .where(eq(storesTable.userId, req.userId));

    if (mine?.slug === slug) {
      return res.json({ available: false, slug, reason: "current" });
    }

    const [existing] = await db
      .select({ id: storesTable.id })
      .from(storesTable)
      .where(eq(storesTable.slug, slug));

    res.json({ available: !existing, slug, reason: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /stores/me/slug — change URL handle
router.patch("/stores/me/slug", requireAuth, async (req: any, res) => {
  const raw = req.body?.slug;
  if (!raw || typeof raw !== "string") {
    return res.status(400).json({ error: "slug is required" });
  }
  const slug = raw.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 50 || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return res.status(400).json({ error: "Invalid slug: 3–50 chars, lowercase letters, numbers, and hyphens only" });
  }

  try {
    const [store] = await db
      .update(storesTable)
      .set({ slug, updatedAt: new Date() })
      .where(eq(storesTable.userId, req.userId))
      .returning();

    if (!store) return res.status(404).json({ error: "No store found" });
    res.json(store);
  } catch (err: any) {
    req.log.error(err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "That URL handle is already taken" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
