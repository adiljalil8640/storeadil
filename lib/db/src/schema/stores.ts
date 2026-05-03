import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const storesTable = pgTable("stores", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  whatsappNumber: text("whatsapp_number"),
  currency: text("currency").notNull().default("USD"),
  logoUrl: text("logo_url"),
  theme: text("theme").notNull().default("light"),
  deliveryEnabled: boolean("delivery_enabled").notNull().default(true),
  pickupEnabled: boolean("pickup_enabled").notNull().default(false),
  shippingNote: text("shipping_note"),
  notificationEmail: text("notification_email"),
  digestFrequency: text("digest_frequency").default("none"),
  category: text("category"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  customDomain: text("custom_domain"),
  storeHours: jsonb("store_hours"),
  holidayClosures: jsonb("holiday_closures"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStoreSchema = createInsertSchema(storesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof storesTable.$inferSelect;
