import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const usageTrackingTable = pgTable("usage_tracking", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  month: text("month").notNull(),
  ordersUsed: integer("orders_used").notNull().default(0),
  bonusOrders: integer("bonus_orders").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique().on(table.userId, table.month),
]);

export type UsageTracking = typeof usageTrackingTable.$inferSelect;
