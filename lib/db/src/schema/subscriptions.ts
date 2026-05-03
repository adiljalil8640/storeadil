import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { plansTable } from "./plans";

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  status: text("status").notNull().default("active"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
