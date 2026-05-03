import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { storesTable, productsTable } from "@workspace/db";
import { eq, and, ilike, sql } from "drizzle-orm";
import { CreateProductBody, UpdateProductBody } from "@workspace/api-zod";

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

// GET /products
router.get("/products", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const { category, search } = req.query;
    let conditions = [eq(productsTable.storeId, storeId)];
    if (category) conditions.push(eq(productsTable.category, category as string));
    if (search) conditions.push(ilike(productsTable.name, `%${search}%`));

    const products = await db
      .select()
      .from(productsTable)
      .where(and(...conditions))
      .orderBy(productsTable.createdAt);

    res.json(products);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /products
router.post("/products", requireAuth, async (req: any, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const [product] = await db
      .insert(productsTable)
      .values({
        ...parsed.data,
        storeId,
        price: String(parsed.data.price),
        variants: (parsed.data.variants ?? []) as any,
      })
      .returning();

    res.status(201).json(product);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /products/categories
router.get("/products/categories", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const rows = await db
      .selectDistinct({ category: productsTable.category })
      .from(productsTable)
      .where(and(eq(productsTable.storeId, storeId), sql`${productsTable.category} IS NOT NULL`));

    res.json(rows.map((r) => r.category).filter(Boolean));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /products/:id
router.get("/products/:id", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, parseInt(req.params.id)), eq(productsTable.storeId, storeId)));

    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /products/:id
router.put("/products/:id", requireAuth, async (req: any, res) => {
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const updateData: any = { ...parsed.data };
    if (updateData.price !== undefined) updateData.price = String(updateData.price);
    if (updateData.variants !== undefined) updateData.variants = updateData.variants as any;

    const [product] = await db
      .update(productsTable)
      .set(updateData)
      .where(and(eq(productsTable.id, parseInt(req.params.id)), eq(productsTable.storeId, storeId)))
      .returning();

    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /products/:id
router.delete("/products/:id", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    await db
      .delete(productsTable)
      .where(and(eq(productsTable.id, parseInt(req.params.id)), eq(productsTable.storeId, storeId)));

    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
