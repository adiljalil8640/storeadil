import { db } from "@workspace/db";
import { storesTable, ordersTable, productsTable, reviewsTable } from "@workspace/db";
import { eq, and, gte, lt, sql, isNull } from "drizzle-orm";
import { sendDigestEmail } from "./email";
import { logger } from "../lib/logger";

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

async function runDigest(frequency: "daily" | "weekly") {
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;
  let periodLabel: string;

  if (frequency === "daily") {
    periodEnd = new Date(now);
    periodEnd.setUTCHours(0, 0, 0, 0);
    periodStart = new Date(periodEnd);
    periodStart.setUTCDate(periodStart.getUTCDate() - 1);
    const day = periodStart.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
    periodLabel = `Yesterday — ${day}`;
  } else {
    periodEnd = new Date(now);
    periodEnd.setUTCHours(0, 0, 0, 0);
    periodStart = new Date(periodEnd);
    periodStart.setUTCDate(periodStart.getUTCDate() - 7);
    const from = periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const to = new Date(periodEnd.getTime() - 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    periodLabel = `Weekly Report — ${from} to ${to}`;
  }

  const stores = await db
    .select()
    .from(storesTable)
    .where(
      and(
        eq(storesTable.digestFrequency, frequency),
        sql`${storesTable.notificationEmail} IS NOT NULL`
      )
    );

  logger.info({ count: stores.length, frequency }, "Running digest for stores");

  const appBaseUrl = process.env.APP_BASE_URL ?? "";

  for (const store of stores) {
    if (!store.notificationEmail) continue;
    try {
      // Orders in period
      const orders = await db
        .select()
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.storeId, store.id),
            gte(ordersTable.createdAt, periodStart),
            lt(ordersTable.createdAt, periodEnd)
          )
        );

      const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
      const totalOrders = orders.length;
      const pendingCount = orders.filter(o => o.status === "pending").length;
      const confirmedCount = orders.filter(o => o.status === "confirmed").length;
      const completedCount = orders.filter(o => o.status === "completed").length;

      // Top products from order line items
      const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
      for (const order of orders) {
        for (const item of (order.items as any[])) {
          if (!productMap[item.productName]) {
            productMap[item.productName] = { name: item.productName, qty: 0, revenue: 0 };
          }
          productMap[item.productName].qty += item.quantity;
          productMap[item.productName].revenue += item.price * item.quantity;
        }
      }
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Low-stock / out-of-stock active products
      const storeProducts = await db
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.storeId, store.id),
            eq(productsTable.isActive, true),
            sql`${productsTable.stock} IS NOT NULL`
          )
        );

      const lowStockProducts = storeProducts
        .filter(p => {
          const stock = p.stock ?? 0;
          const threshold = p.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
          return stock <= threshold;
        })
        .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
        .map(p => ({
          name: p.name,
          stock: p.stock ?? 0,
          threshold: p.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
          category: p.category,
        }));

      // New reviews received in this period (unreplied = needs attention)
      const periodReviews = await db
        .select({
          rating: reviewsTable.rating,
          comment: reviewsTable.comment,
          customerName: reviewsTable.customerName,
          merchantReply: reviewsTable.merchantReply,
          productId: reviewsTable.productId,
        })
        .from(reviewsTable)
        .where(
          and(
            eq(reviewsTable.storeId, store.id),
            gte(reviewsTable.createdAt, periodStart),
            lt(reviewsTable.createdAt, periodEnd)
          )
        );

      // Resolve product names for the reviews
      const productIds = [...new Set(periodReviews.map(r => r.productId))];
      const reviewProducts = productIds.length > 0
        ? await db
            .select({ id: productsTable.id, name: productsTable.name })
            .from(productsTable)
            .where(sql`${productsTable.id} = ANY(ARRAY[${sql.raw(productIds.join(","))}]::int[])`)
        : [];
      const productNameById = Object.fromEntries(reviewProducts.map(p => [p.id, p.name]));

      const newReviews = periodReviews.map(r => ({
        productName: productNameById[r.productId] ?? "Unknown product",
        rating: r.rating,
        customerName: r.customerName,
        comment: r.comment,
      }));

      await sendDigestEmail({
        to: store.notificationEmail,
        storeName: store.name,
        currency: store.currency,
        periodLabel,
        frequency,
        totalOrders,
        totalRevenue,
        pendingCount,
        confirmedCount,
        completedCount,
        topProducts,
        lowStockProducts,
        newReviews,
        appBaseUrl,
      });
    } catch (err) {
      logger.error({ err, storeId: store.id }, "Failed to send digest to store");
    }
  }
}

function scheduleNextRun(task: () => void, targetHourUTC: number) {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(targetHourUTC, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const msUntilNext = next.getTime() - now.getTime();

  setTimeout(() => {
    task();
    setInterval(task, 24 * 60 * 60 * 1000);
  }, msUntilNext);

  logger.info(
    { nextRun: next.toISOString(), msUntilNext },
    "Digest scheduler armed"
  );
}

export function startDigestScheduler() {
  scheduleNextRun(async () => {
    const dayOfWeek = new Date().getUTCDay(); // 0=Sun, 1=Mon
    // Always run daily digest
    await runDigest("daily").catch(err =>
      logger.error({ err }, "Daily digest failed")
    );
    // Run weekly digest on Mondays
    if (dayOfWeek === 1) {
      await runDigest("weekly").catch(err =>
        logger.error({ err }, "Weekly digest failed")
      );
    }
  }, 8); // 8 AM UTC
}
