import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const aiProvidersTable = pgTable("ai_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull(),
  defaultModel: text("default_model").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AiProvider = typeof aiProvidersTable.$inferSelect;
