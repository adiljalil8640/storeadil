import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: text("referrer_id").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  referredUserId: text("referred_user_id"),
  rewardApplied: boolean("reward_applied").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Referral = typeof referralsTable.$inferSelect;
