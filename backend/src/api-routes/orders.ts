import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable, ordersTable, couponsTable } from "@workspace/db";
import { eq, and, desc, sql, ilike, gte, lte, inArray } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderStatusBody, UpdateOrderNoteBody, BulkUpdateOrderStatusBody } from "@workspace/api-zod";
import { validate } from "../middlewares/validate";
import { checkOrderLimit, incrementOrderUsage } from "../services/usage";
import { sendOrderConfirmation, sendStatusUpdateEmail, sendNewOrderNotification, sendLowStockAlert } from "../services/email";
import { productsTable } from "@workspace/db";
import { publicOrderLimiter, publicTrackLimiter } from "../middlewares/rateLimiter";
import { requireAuth, requireStore } from "../middlewares/auth";

const router = Router();

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
router.get("/orders", requireAuth, requireStore, async (req: any, res) => {
  try {
    const storeId = req.storeId;

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
    throw err;
  }
});

// POST /orders (public - from storefront, tracks usage per store owner)
router.post("/orders", publicOrderLimiter, async (req: any, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const { storeId, items, customerName, customerEmail, customerPhone, customerNote, deliveryType, couponCode } = parsed.data;

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

    const subtotal = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    // Validate and apply coupon if provided
    let discountAmount = 0;
    let appliedCouponId: number | null = null;

    if (couponCode && couponCode.trim()) {
      const [coupon] = await db
        .select()
        .from(couponsTable)
        .where(and(eq(couponsTable.storeId, storeId), ilike(couponsTable.code, couponCode.trim())));

      if (coupon && coupon.isActive &&
        (!coupon.expiresAt || new Date(coupon.expiresAt) >= new Date()) &&
        (coupon.maxUses === null || coupon.usedCount < coupon.maxUses) &&
        (coupon.minOrderAmount === null || subtotal >= Number(coupon.minOrderAmount))
      ) {
        const val = Number(coupon.value);
        discountAmount = coupon.type === "percentage"
          ? Math.round((subtotal * val / 100) * 100) / 100
          : Math.min(val, subtotal);
        appliedCouponId = coupon.id;
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    const noteWithDiscount = discountAmount > 0
      ? `${customerNote ? customerNote + "\n" : ""}[Coupon: ${couponCode?.toUpperCase()} — -${store.currency} ${discountAmount.toFixed(2)}]`
      : (customerNote ?? null);

    const [order] = await db
      .insert(ordersTable)
      .values({
        storeId,
        customerName: customerName ?? null,
        customerEmail: customerEmail ?? null,
        customerPhone: customerPhone ?? null,
        customerNote: noteWithDiscount,
        items: items as any,
        total: String(total),
        status: "pending",
        deliveryType: deliveryType ?? null,
      })
      .returning();

    // Increment coupon usedCount (fire-and-forget)
    if (appliedCouponId) {
      db.update(couponsTable)
        .set({ usedCount: sql`${couponsTable.usedCount} + 1` })
        .where(eq(couponsTable.id, appliedCouponId))
        .catch(() => {});
    }

    await incrementOrderUsage(store.userId);

    // Decrement stock for each ordered product (fire-and-forget; errors don't block the response)
    (async () => {
      try {
        const productIds = items
          .map((item: any) => item.productId)
          .filter((id: any) => typeof id === "number");
        if (productIds.length === 0) return;

        // Decrement stock for each product
        for (const item of items as any[]) {
          if (typeof item.productId !== "number") continue;
          await db
            .update(productsTable)
            .set({ stock: sql`GREATEST(0, COALESCE(${productsTable.stock}, 0) - ${item.quantity})` })
            .where(
              and(
                eq(productsTable.id, item.productId),
                eq(productsTable.storeId, storeId),
                sql`${productsTable.stock} IS NOT NULL`
              )
            );
        }

        // Check for products that have fallen at or below their threshold
        if (store.notificationEmail) {
          const updatedProducts = await db
            .select({
              name: productsTable.name,
              stock: productsTable.stock,
              lowStockThreshold: productsTable.lowStockThreshold,
              category: productsTable.category,
            })
            .from(productsTable)
            .where(
              and(
                eq(productsTable.storeId, storeId),
                sql`${productsTable.id} = ANY(ARRAY[${sql.join(productIds.map((id: number) => sql`${id}`), sql`, `)}]::int[])`,
                sql`${productsTable.lowStockThreshold} IS NOT NULL`,
                sql`${productsTable.stock} IS NOT NULL`,
                sql`${productsTable.stock} <= ${productsTable.lowStockThreshold}`
              )
            );

          if (updatedProducts.length > 0) {
            const appBaseUrl = `${req.protocol}://${req.get("host")}`;
            sendLowStockAlert({
              to: store.notificationEmail,
              storeName: store.name,
              products: updatedProducts.map(p => ({
                name: p.name,
                stock: p.stock!,
                threshold: p.lowStockThreshold!,
                category: p.category,
              })),
              appBaseUrl,
            }).catch(() => {});
          }
        }
      } catch {}
    })();

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
    throw err;
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /orders/export — download orders as CSV (optional ?from=YYYY-MM-DD&to=YYYY-MM-DD)
router.get("/orders/export", requireAuth, requireStore, async (req: any, res) => {
  try {
    const storeId = req.storeId;

    const fromStr = req.query.from as string | undefined;
    const toStr   = req.query.to   as string | undefined;

    const conditions: any[] = [eq(ordersTable.storeId, storeId)];
    if (fromStr) conditions.push(gte(ordersTable.createdAt, new Date(fromStr + "T00:00:00.000Z")));
    if (toStr)   conditions.push(lte(ordersTable.createdAt, new Date(toStr   + "T23:59:59.999Z")));

    const orders = await db
      .select()
      .from(ordersTable)
      .where(and(...conditions))
      .orderBy(ordersTable.createdAt);

    // CSV escaping
    const esc = (v: any): string => {
      const s = v == null ? "" : String(v);
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows: string[] = [
      ["Order ID","Date","Customer Name","Customer Email","Customer Phone",
       "Delivery","Status","Product","Qty","Unit Price","Line Total","Order Total"].join(","),
    ];

    const productMap: Record<string, { orders: Set<number>; qty: number; revenue: number }> = {};

    for (const order of orders) {
      const items  = (order.items as any[]) ?? [];
      const date   = order.createdAt.toISOString().slice(0, 10);
      const common = [
        esc(order.id), esc(date), esc(order.customerName), esc(order.customerEmail),
        esc(order.customerPhone), esc(order.deliveryType), esc(order.status),
      ];

      if (items.length === 0) {
        rows.push([...common, "", "", "", "", esc(Number(order.total).toFixed(2))].join(","));
      } else {
        for (const item of items) {
          const unitPrice = Number(item.price ?? 0);
          const qty       = Number(item.quantity ?? 1);
          const lineTotal = unitPrice * qty;
          rows.push([
            ...common,
            esc(item.productName), esc(qty),
            esc(unitPrice.toFixed(2)), esc(lineTotal.toFixed(2)),
            esc(Number(order.total).toFixed(2)),
          ].join(","));
          const key = String(item.productName || "Unknown");
          if (!productMap[key]) productMap[key] = { orders: new Set(), qty: 0, revenue: 0 };
          productMap[key].orders.add(order.id);
          productMap[key].qty     += qty;
          productMap[key].revenue += lineTotal;
        }
      }
    }

    // Product revenue summary
    rows.push("", "Revenue by Product",
      ["Product", "Orders", "Units Sold", "Revenue"].join(","));
    for (const [name, d] of Object.entries(productMap)
        .sort((a, b) => b[1].revenue - a[1].revenue)) {
      rows.push([esc(name), esc(d.orders.size), esc(d.qty), esc(d.revenue.toFixed(2))].join(","));
    }

    const label = `${fromStr ?? "all"}-to-${toStr ?? "now"}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="orders-${label}.csv"`);
    return res.send(rows.join("\n"));
  } catch (err) {
    throw err;
  }
});

// GET /orders/track/:token (public — customer order tracking)
router.get("/orders/track/:token", publicTrackLimiter, async (req: any, res) => {
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
    throw err;
  }
});

// GET /orders/:id
router.get("/orders/:id", requireAuth, requireStore, async (req: any, res) => {
  try {
    const storeId = req.storeId;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, parseInt(req.params.id)), eq(ordersTable.storeId, storeId)));

    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    throw err;
  }
});

// PATCH /orders/:id
router.patch("/orders/:id", requireAuth, requireStore, async (req: any, res) => {
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const storeId = req.storeId;

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
    throw err;
  }
});

// GET /orders/customer-history — all orders + stats for a customer
router.get("/orders/customer-history", requireAuth, requireStore, async (req: any, res) => {
  const { phone, email } = req.query as { phone?: string; email?: string };

  if (!phone && !email) {
    return res.status(400).json({ error: "Provide phone or email" });
  }

  try {
    const storeId = req.storeId;

    const allOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.storeId, storeId))
      .orderBy(desc(ordersTable.createdAt));

    const customerOrders = allOrders.filter((o) => {
      if (phone && o.customerPhone === phone) return true;
      if (email && o.customerEmail === email) return true;
      return false;
    });

    if (customerOrders.length === 0) {
      return res.status(404).json({ error: "No orders found for this customer" });
    }

    const first = customerOrders[0];
    const totalSpend = customerOrders.reduce((sum, o) => sum + Number(o.total), 0);

    return res.json({
      customer: {
        name: first.customerName ?? null,
        phone: first.customerPhone ?? null,
        email: first.customerEmail ?? null,
      },
      orders: customerOrders,
      stats: {
        totalOrders: customerOrders.length,
        totalSpend,
        avgOrderValue: totalSpend / customerOrders.length,
      },
    });
  } catch (err) {
    throw err;
  }
});

// PATCH /orders/:id/note — set or clear the owner-only internal note
router.patch("/orders/:id/note", requireAuth, requireStore, validate(UpdateOrderNoteBody), async (req: any, res) => {
  const orderId = Number(req.params.id);
  const { ownerNote } = req.body;

  if (isNaN(orderId)) return res.status(400).json({ error: "Invalid order id" });

  try {
    const storeId = req.storeId;

    const [order] = await db
      .update(ordersTable)
      .set({ ownerNote: ownerNote ?? null, updatedAt: new Date() })
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.storeId, storeId)))
      .returning();

    if (!order) return res.status(404).json({ error: "Order not found" });
    return res.json(order);
  } catch (err) {
    throw err;
  }
});

// POST /orders/bulk-status — update status for multiple orders at once
router.post("/orders/bulk-status", requireAuth, requireStore, validate(BulkUpdateOrderStatusBody), async (req: any, res) => {
  const { orderIds, status } = req.body;
  const VALID = ["pending", "confirmed", "completed", "cancelled"];

  if (orderIds.length === 0) {
    return res.status(400).json({ error: "orderIds must be a non-empty array" });
  }
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID.join(", ")}` });
  }

  try {
    const result = await db
      .update(ordersTable)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(ordersTable.storeId, req.storeId), inArray(ordersTable.id, orderIds)));

    return res.json({ updated: orderIds.length });
  } catch (err) {
    throw err;
  }
});

export default router;
