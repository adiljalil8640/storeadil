import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { storesTable, ordersTable, productsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderStatusBody } from "@workspace/api-zod";

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

function buildWhatsAppUrl(phoneNumber: string, items: any[], total: number, currency: string, customerName?: string | null, customerNote?: string | null): string {
  const itemLines = items.map((item: any) => {
    const variants = item.selectedVariants
      ? Object.entries(item.selectedVariants).map(([k, v]) => ` (${k}: ${v})`).join("")
      : "";
    return `• ${item.productName}${variants} x${item.quantity} — ${currency} ${(item.price * item.quantity).toFixed(2)}`;
  });

  const message = [
    `🛒 New Order${customerName ? ` from ${customerName}` : ""}`,
    "",
    ...itemLines,
    "",
    `*Total: ${currency} ${total.toFixed(2)}*`,
    customerNote ? `\nNote: ${customerNote}` : "",
  ].filter(v => v !== undefined).join("\n");

  const phone = phoneNumber.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// GET /orders
router.get("/orders", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const { status, limit } = req.query;
    let conditions = [eq(ordersTable.storeId, storeId)];
    if (status) conditions.push(eq(ordersTable.status, status as string));

    const orders = await db
      .select()
      .from(ordersTable)
      .where(and(...conditions))
      .orderBy(desc(ordersTable.createdAt))
      .limit(parseInt(limit as string) || 50);

    res.json(orders);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /orders (public - from storefront)
router.post("/orders", async (req: any, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const { storeId, items, customerName, customerPhone, customerNote, deliveryType } = parsed.data;

    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId));
    if (!store) return res.status(404).json({ error: "Store not found" });

    const total = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    const [order] = await db
      .insert(ordersTable)
      .values({
        storeId,
        customerName: customerName ?? null,
        customerPhone: customerPhone ?? null,
        customerNote: customerNote ?? null,
        items: items as any,
        total: String(total),
        status: "pending",
        deliveryType: deliveryType ?? null,
      })
      .returning();

    const whatsappUrl = store.whatsappNumber
      ? buildWhatsAppUrl(store.whatsappNumber, items, total, store.currency, customerName, customerNote)
      : "";

    res.status(201).json({ order, whatsappUrl });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /orders/:id
router.get("/orders/:id", requireAuth, async (req: any, res) => {
  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, parseInt(req.params.id)), eq(ordersTable.storeId, storeId)));

    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /orders/:id
router.patch("/orders/:id", requireAuth, async (req: any, res) => {
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const storeId = await getStoreId(req.userId);
    if (!storeId) return res.status(404).json({ error: "No store found" });

    const [order] = await db
      .update(ordersTable)
      .set({ status: parsed.data.status })
      .where(and(eq(ordersTable.id, parseInt(req.params.id)), eq(ordersTable.storeId, storeId)))
      .returning();

    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
