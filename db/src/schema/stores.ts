import { pgTable, serial, text, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
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
  temporarilyClosed: boolean("temporarily_closed").default(false),
  temporaryClosedMessage: text("temporarily_closed_message"),
  monthlyRevenueGoal: numeric("monthly_revenue_goal"),
  // WhatsApp Auto-Reply
  waMode: text("wa_mode").default("none"),           // none | business-api | web-js
  waBizPhoneId: text("wa_biz_phone_id"),             // Meta phone number ID
  waBizAccessToken: text("wa_biz_access_token"),     // Meta permanent access token
  waBizVerifyToken: text("wa_biz_verify_token"),     // Webhook verify token (user sets)
  waAutoReply: boolean("wa_auto_reply").default(false),
  waReplyPrompt: text("wa_reply_prompt"),            // Custom system prompt for AI replies
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
