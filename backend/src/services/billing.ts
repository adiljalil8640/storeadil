import { db } from "@workspace/db";
import { plansTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export const PLAN_DEFINITIONS = [
  {
    name: "free",
    displayName: "Free",
    priceMonthly: "0",
    maxProducts: 10,
    maxOrdersPerMonth: 50,
    isUnlimited: false,
    features: ["10 products", "50 orders/month", "Public storefront", "WhatsApp checkout"],
  },
  {
    name: "pro",
    displayName: "Pro",
    priceMonthly: "19.00",
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
    maxProducts: 100,
    maxOrdersPerMonth: 500,
    isUnlimited: false,
    features: ["100 products", "500 orders/month", "AI description generator", "AI price suggester", "Priority support"],
  },
  {
    name: "business",
    displayName: "Business",
    priceMonthly: "49.00",
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS ?? null,
    maxProducts: 99999,
    maxOrdersPerMonth: 99999,
    isUnlimited: true,
    features: ["Unlimited products", "Unlimited orders", "All Pro features", "QR code generator", "Referral rewards", "Admin analytics"],
  },
];

export async function seedPlans() {
  for (const plan of PLAN_DEFINITIONS) {
    await db
      .insert(plansTable)
      .values(plan as any)
      .onConflictDoUpdate({
        target: plansTable.name,
        set: {
          displayName: plan.displayName,
          priceMonthly: plan.priceMonthly,
          maxProducts: plan.maxProducts,
          maxOrdersPerMonth: plan.maxOrdersPerMonth,
          isUnlimited: plan.isUnlimited,
          features: plan.features,
        },
      });
  }
}

export async function getOrCreateSubscription(userId: string) {
  const existing = await db
    .select({ sub: subscriptionsTable, plan: plansTable })
    .from(subscriptionsTable)
    .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));

  if (existing[0]) return existing[0];

  const [freePlan] = await db.select().from(plansTable).where(eq(plansTable.name, "free"));
  if (!freePlan) throw new Error("Free plan not found — run seedPlans first");

  const [sub] = await db
    .insert(subscriptionsTable)
    .values({ userId, planId: freePlan.id, status: "active" })
    .returning();

  return { sub, plan: freePlan };
}

export async function getPlanByName(name: string) {
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.name, name));
  return plan ?? null;
}

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}
