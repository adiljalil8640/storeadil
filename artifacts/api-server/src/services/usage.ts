import { db } from "@workspace/db";
import { usageTrackingTable, storesTable, ordersTable, productsTable } from "@workspace/db";
import { eq, and, sql, count } from "drizzle-orm";
import { getOrCreateSubscription } from "./billing";

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getOrCreateUsageRecord(userId: string) {
  const month = getCurrentMonth();
  const [existing] = await db
    .select()
    .from(usageTrackingTable)
    .where(and(eq(usageTrackingTable.userId, userId), eq(usageTrackingTable.month, month)));

  if (existing) return existing;

  const [created] = await db
    .insert(usageTrackingTable)
    .values({ userId, month, ordersUsed: 0, bonusOrders: 0 })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [record] = await db
    .select()
    .from(usageTrackingTable)
    .where(and(eq(usageTrackingTable.userId, userId), eq(usageTrackingTable.month, month)));
  return record;
}

export async function checkProductLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number; planName: string; planDisplayName: string }> {
  const { plan } = await getOrCreateSubscription(userId);

  if (plan.isUnlimited) return { allowed: true, current: 0, limit: -1, planName: plan.name, planDisplayName: plan.displayName };

  const [store] = await db.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.userId, userId));
  if (!store) return { allowed: true, current: 0, limit: plan.maxProducts, planName: plan.name, planDisplayName: plan.displayName };

  const [{ total }] = await db
    .select({ total: count() })
    .from(productsTable)
    .where(eq(productsTable.storeId, store.id));

  return {
    allowed: total < plan.maxProducts,
    current: total,
    limit: plan.maxProducts,
    planName: plan.name,
    planDisplayName: plan.displayName,
  };
}

export async function checkOrderLimit(storeUserId: string): Promise<{ allowed: boolean; current: number; limit: number; planName: string; planDisplayName: string }> {
  const { plan } = await getOrCreateSubscription(storeUserId);

  if (plan.isUnlimited) return { allowed: true, current: 0, limit: -1, planName: plan.name, planDisplayName: plan.displayName };

  const usage = await getOrCreateUsageRecord(storeUserId);
  const effectiveLimit = plan.maxOrdersPerMonth + (usage.bonusOrders ?? 0);
  const current = usage.ordersUsed ?? 0;

  return {
    allowed: current < effectiveLimit,
    current,
    limit: effectiveLimit,
    planName: plan.name,
    planDisplayName: plan.displayName,
  };
}

export async function incrementOrderUsage(userId: string) {
  const month = getCurrentMonth();
  await db
    .insert(usageTrackingTable)
    .values({ userId, month, ordersUsed: 1, bonusOrders: 0 })
    .onConflictDoUpdate({
      target: [usageTrackingTable.userId, usageTrackingTable.month],
      set: { ordersUsed: sql`${usageTrackingTable.ordersUsed} + 1`, updatedAt: new Date() },
    });
}

export async function getUserUsageSummary(userId: string) {
  const { plan } = await getOrCreateSubscription(userId);
  const usage = await getOrCreateUsageRecord(userId);

  const [store] = await db.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.userId, userId));
  let productsUsed = 0;
  if (store) {
    const [{ total }] = await db.select({ total: count() }).from(productsTable).where(eq(productsTable.storeId, store.id));
    productsUsed = total;
  }

  const ordersUsed = usage?.ordersUsed ?? 0;
  const bonusOrders = usage?.bonusOrders ?? 0;
  const ordersLimit = plan.isUnlimited ? 999999 : plan.maxOrdersPerMonth + bonusOrders;
  const productsLimit = plan.isUnlimited ? 999999 : plan.maxProducts;
  const usagePercent = plan.isUnlimited ? 0 : Math.round((ordersUsed / ordersLimit) * 100);

  return {
    plan,
    ordersUsed,
    ordersLimit,
    productsUsed,
    productsLimit,
    usagePercent,
    isNearLimit: !plan.isUnlimited && usagePercent >= 80,
  };
}
