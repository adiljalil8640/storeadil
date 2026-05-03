import { pgTable, serial, text, numeric, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }).notNull().default("0"),
  stripePriceId: text("stripe_price_id"),
  maxProducts: integer("max_products").notNull().default(10),
  maxOrdersPerMonth: integer("max_orders_per_month").notNull().default(50),
  isUnlimited: boolean("is_unlimited").notNull().default(false),
  features: jsonb("features").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Plan = typeof plansTable.$inferSelect;
