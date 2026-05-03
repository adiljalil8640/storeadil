import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";
import { ordersTable } from "./orders";
import { productsTable } from "./products";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => storesTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  customerName: text("customer_name"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  merchantReply: text("merchant_reply"),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique().on(t.orderId, t.productId),
]);

export type Review = typeof reviewsTable.$inferSelect;
