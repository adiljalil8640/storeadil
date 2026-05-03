import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { storesTable, ordersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderStatusBody } from "@workspace/api-zod";
import { checkOrderLimit, incrementOrderUsage } from "../services/usage";
import { sendOrderConfirmation, sendStatusUpdateEmail, sendNewOrderNotification } from "../services/email";

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
    const conditions: any[] = [eq(ordersTable.storeId, storeId)];
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

// POST /orders (public - from storefront, tracks usage per store owner)
router.post("/orders", async (req: any, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const { storeId, items, customerName, customerEmail, customerPhone, customerNote, deliveryType } = parsed.data;

    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId));
    if (!store) return res.status(404).json({ error: "Store not found" });

    const limitCheck = await checkOrderLimit(store.userId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: `This store has reached its monthly order limit`,
        code: "ORDER_LIMIT_REACHED",
        limit: limitCheck.limit,
        current: limitCheck.current,
        planName: limitCheck.planName,
        planDisplayName: limitCheck.planDisplayName,
      });
    }

    const total = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    const [order] = await db
      .insert(ordersTable)
      .values({
        storeId,
        customerName: customerName ?? null,
        customerEmail: customerEmail ?? null,
        customerPhone: customerPhone ?? null,
        customerNote: customerNote ?? null,
        items: items as any,
        total: String(total),
        status: "pending",
        deliveryType: deliveryType ?? null,
      })
      .returning();

    await incrementOrderUsage(store.userId);

    const whatsappUrl = store.whatsappNumber
      ? buildWhatsAppUrl(store.whatsappNumber, items, total, store.currency, customerName, customerNote)
      : "";

    const appBaseUrl = `${req.protocol}://${req.get("host")}`;

    // Merchant new-order notification (fire-and-forget)
    if (store.notificationEmail) {
      sendNewOrderNotification({
        to: store.notificationEmail,
        orderId: order.id,
        trackingToken: order.trackingToken,
        customerName: customerName ?? null,
        customerEmail: customerEmail ?? null,
        customerPhone: customerPhone ?? null,
        items,
        total,
        currency: store.currency,
        storeName: store.name,
        deliveryType: deliveryType ?? null,
        customerNote: customerNote ?? null,
        appBaseUrl,
      }).catch(() => {});
    }

    // Customer confirmation email (fire-and-forget; no key = no-op)
    if (customerEmail) {
      sendOrderConfirmation({
        to: customerEmail,
        customerName: customerName ?? null,
        orderId: order.id,
        trackingToken: order.trackingToken,
        items,
        total,
        currency: store.currency,
        storeName: store.name,
        deliveryType: deliveryType ?? null,
        appBaseUrl,
      }).catch(() => {});
    }

    res.status(201).json({ order, whatsappUrl });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /orders/track/:token (public — customer order tracking)
router.get("/orders/track/:token", async (req: any, res) => {
  try {
    const { token } = req.params;
    if (!UUID_RE.test(token)) return res.status(404).json({ error: "Order not found" });
    const [order] = await db
      .select({
        id: ordersTable.id,
        trackingToken: ordersTable.trackingToken,
        status: ordersTable.status,
        customerName: ordersTable.customerName,
        items: ordersTable.items,
        total: ordersTable.total,
        deliveryType: ordersTable.deliveryType,
        createdAt: ordersTable.createdAt,
        storeName: storesTable.name,
        storeSlug: storesTable.slug,
        currency: storesTable.currency,
      })
      .from(ordersTable)
      .innerJoin(storesTable, eq(ordersTable.storeId, storesTable.id))
      .where(eq(ordersTable.trackingToken, token));

    if (!order) return res.status(404).json({ error: "Order not found" });

    res.json({
      orderId: order.id,
      trackingToken: order.trackingToken,
      status: order.status,
      customerName: order.customerName,
      items: order.items,
      total: Number(order.total),
      deliveryType: order.deliveryType,
      createdAt: order.createdAt,
      storeName: order.storeName,
      storeSlug: order.storeSlug,
      currency: order.currency,
    });
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

    // Send status-update email (fire-and-forget; no key = no-op)
    if (order.customerEmail) {
      const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId));
      if (store) {
        const appBaseUrl = `${req.protocol}://${req.get("host")}`;
        sendStatusUpdateEmail({
          to: order.customerEmail,
          customerName: order.customerName ?? null,
          orderId: order.id,
          trackingToken: order.trackingToken,
          newStatus: parsed.data.status,
          items: order.items as any[],
          total: Number(order.total),
          currency: store.currency,
          storeName: store.name,
          appBaseUrl,
        }).catch(() => {});
      }
    }

    res.json(order);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
