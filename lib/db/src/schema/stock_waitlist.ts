import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { storesTable } from "./stores";

export const stockWaitlistTable = pgTable("stock_waitlist", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  storeId: integer("store_id").notNull().references(() => storesTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type StockWaitlistEntry = typeof stockWaitlistTable.$inferSelect;
