import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable, productsTable, stockWaitlistTable } from "@workspace/db";
import { eq, and, ilike, sql, isNull } from "drizzle-orm";
import { CreateProductBody, UpdateProductBody, ImportProductsBody } from "@workspace/api-zod";
import { validate } from "../middlewares/validate";
import { checkProductLimit } from "../services/usage";
import { sendBackInStockEmail } from "../services/email";
import { requireAuth, requireStore } from "../middlewares/auth";

const router = Router();
router.use(requireAuth, requireStore);

// GET /products
router.get("/products", async (req: any, res) => {
  try {
    const storeId = req.storeId;

    const { category, search } = req.query;
    const conditions: any[] = [eq(productsTable.storeId, storeId)];
    if (category) conditions.push(eq(productsTable.category, category as string));
    if (search) conditions.push(ilike(productsTable.name, `%${search}%`));

    const products = await db
      .select()
      .from(productsTable)
      .where(and(...conditions))
      .orderBy(productsTable.createdAt);

    res.json(products);
  } catch (err) {
    throw err;
  }
});

// POST /products
router.post("/products", async (req: any, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const limitCheck = await checkProductLimit(req.userId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: `Product limit reached for ${limitCheck.planDisplayName} plan`,
        code: "PRODUCT_LIMIT_REACHED",
        limit: limitCheck.limit,
        current: limitCheck.current,
        planName: limitCheck.planName,
        planDisplayName: limitCheck.planDisplayName,
      });
    }

    const storeId = req.storeId;

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
    throw err;
  }
});

// GET /products/categories
router.get("/products/categories", async (req: any, res) => {
  try {
    const storeId = req.storeId;

    const rows = await db
      .selectDistinct({ category: productsTable.category })
      .from(productsTable)
      .where(and(eq(productsTable.storeId, storeId), sql`${productsTable.category} IS NOT NULL`));

    res.json(rows.map((r) => r.category).filter(Boolean));
  } catch (err) {
    throw err;
  }
});

// POST /products/import — bulk CSV import
router.post("/products/import", validate(ImportProductsBody), async (req: any, res) => {
  const { csv } = req.body;
  if (!csv.trim()) {
    return res.status(400).json({ error: "csv field is required" });
  }

  try {
    const storeId = req.storeId;

    const lines = csv.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return res.json({ imported: 0, skipped: 0, errors: ["CSV must have a header row and at least one data row"] });
    }

    const parseCell = (s: string) => s.replace(/^["']|["']$/g, "").trim();
    const header = lines[0].split(",").map((h: string) => parseCell(h).toLowerCase().replace(/\s+/g, "_"));

    const col = (row: string[], key: string): string => {
      const idx = header.indexOf(key);
      return idx >= 0 ? parseCell(row[idx] ?? "") : "";
    };

    const errors: string[] = [];
    const toInsert: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",");
      const lineNum = i + 1;

      const name = col(row, "name");
      const priceStr = col(row, "price");
      const description = col(row, "description") || null;
      const category = col(row, "category") || null;
      const stockStr = col(row, "stock");
      const thresholdStr = col(row, "low_stock_threshold");

      if (!name) { errors.push(`Row ${lineNum}: name is required`); continue; }
      const price = parseFloat(priceStr);
      if (isNaN(price) || price < 0) { errors.push(`Row ${lineNum}: invalid price "${priceStr}"`); continue; }

      const stock = stockStr !== "" ? parseInt(stockStr) : null;
      if (stockStr !== "" && isNaN(stock!)) { errors.push(`Row ${lineNum}: invalid stock "${stockStr}"`); continue; }

      const lowStockThreshold = thresholdStr !== "" ? parseInt(thresholdStr) : null;

      toInsert.push({
        storeId,
        name,
        description,
        price: String(price),
        category,
        stock: stock ?? null,
        lowStockThreshold: lowStockThreshold ?? null,
        isActive: true,
        variants: [],
      });
    }

    if (toInsert.length === 0) {
      return res.json({ imported: 0, skipped: lines.length - 1, errors });
    }

    const limitCheck = await checkProductLimit(req.userId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: `Product limit reached for ${limitCheck.planDisplayName} plan`,
        code: "PRODUCT_LIMIT_REACHED",
        limit: limitCheck.limit,
        current: limitCheck.current,
      });
    }

    const BATCH = 50;
    let imported = 0;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      await db.insert(productsTable).values(batch);
      imported += batch.length;
    }

    req.log.info({ imported, storeId }, "Bulk CSV import completed");
    res.json({ imported, skipped: errors.length, errors });
  } catch (err) {
    throw err;
  }
});

// GET /products/:id
router.get("/products/:id", async (req: any, res) => {
  try {
    const storeId = req.storeId;

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, parseInt(req.params.id)), eq(productsTable.storeId, storeId)));

    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    throw err;
  }
});

// PUT /products/:id
router.put("/products/:id", async (req: any, res) => {
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const storeId = req.storeId;

    const updateData: any = { ...parsed.data };
    if (updateData.price !== undefined) updateData.price = String(updateData.price);
    if (updateData.variants !== undefined) updateData.variants = updateData.variants as any;

    // Fetch current stock before update to detect back-in-stock transition
    const [before] = await db
      .select({ stock: productsTable.stock })
      .from(productsTable)
      .where(and(eq(productsTable.id, parseInt(req.params.id)), eq(productsTable.storeId, storeId)));

    const [product] = await db
      .update(productsTable)
      .set(updateData)
      .where(and(eq(productsTable.id, parseInt(req.params.id)), eq(productsTable.storeId, storeId)))
      .returning();

    if (!product) return res.status(404).json({ error: "Product not found" });

    // Back-in-stock: was 0 (or null), now > 0 — notify waitlist (fire-and-forget)
    const wasOutOfStock = before && (before.stock === 0 || before.stock === null);
    const isNowInStock = product.stock !== null && product.stock > 0;
    if (wasOutOfStock && isNowInStock) {
      (async () => {
        try {
          const waitlist = await db
            .select()
            .from(stockWaitlistTable)
            .where(
              and(
                eq(stockWaitlistTable.productId, product.id),
                isNull(stockWaitlistTable.notifiedAt)
              )
            );
          if (waitlist.length === 0) return;

          const [store] = await db
            .select({ name: storesTable.name, slug: storesTable.slug, currency: storesTable.currency })
            .from(storesTable)
            .where(eq(storesTable.id, storeId));
          if (!store) return;

          const appBaseUrl = `${req.protocol}://${req.get("host")}`;
          const now = new Date();

          for (const entry of waitlist) {
            sendBackInStockEmail({
              to: entry.email,
              name: entry.name,
              storeName: store.name,
              productName: product.name,
              productPrice: Number(product.price),
              currency: store.currency,
              storeSlug: store.slug,
              appBaseUrl,
            }).catch(() => {});

            // Mark as notified
            await db
              .update(stockWaitlistTable)
              .set({ notifiedAt: now })
              .where(eq(stockWaitlistTable.id, entry.id));
          }

          req.log.info({ productId: product.id, notified: waitlist.length }, "Back-in-stock emails queued");
        } catch {}
      })();
    }

    res.json(product);
  } catch (err) {
    throw err;
  }
});

// DELETE /products/:id
router.delete("/products/:id", async (req: any, res) => {
  try {
    const storeId = req.storeId;

    await db
      .delete(productsTable)
      .where(and(eq(productsTable.id, parseInt(req.params.id)), eq(productsTable.storeId, storeId)));

    res.status(204).send();
  } catch (err) {
    throw err;
  }
});

export default router;
