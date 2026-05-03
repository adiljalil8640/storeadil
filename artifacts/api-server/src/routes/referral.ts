import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { referralsTable, usageTrackingTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { getCurrentMonth } from "../services/usage";

const router = Router();

const REFERRAL_BONUS_ORDERS = 50;

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
}

function generateReferralCode(userId: string): string {
  const base = userId.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${base}${suffix}`;
}

async function getOrCreateReferral(userId: string) {
  const [existing] = await db
    .select()
    .from(referralsTable)
    .where(and(eq(referralsTable.referrerId, userId), sql`${referralsTable.referredUserId} IS NULL`));

  if (existing) return existing;

  const code = generateReferralCode(userId);
  const [created] = await db
    .insert(referralsTable)
    .values({ referrerId: userId, referralCode: code })
    .returning();

  return created;
}

// GET /referral/preview/:code — public, returns just enough info to show invitation banner
router.get("/referral/preview/:code", async (req: any, res) => {
  try {
    const code = req.params.code?.trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "Code required" });

    const [referral] = await db
      .select({ referrerId: referralsTable.referrerId, referralCode: referralsTable.referralCode })
      .from(referralsTable)
      .where(eq(referralsTable.referralCode, code));

    if (!referral) return res.status(404).json({ error: "Referral code not found" });

    // Look up the referrer's store name
    const { storesTable } = await import("@workspace/db");
    const [store] = await db
      .select({ name: storesTable.name })
      .from(storesTable)
      .where(eq(storesTable.userId, referral.referrerId));

    res.json({
      referralCode: referral.referralCode,
      referrerStoreName: store?.name ?? null,
      bonusOrders: REFERRAL_BONUS_ORDERS,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /referral/me
router.get("/referral/me", requireAuth, async (req: any, res) => {
  try {
    const referral = await getOrCreateReferral(req.userId);
    const origin = req.headers.origin ?? `https://${req.headers.host}`;

    const [{ total: referredCount }] = await db
      .select({ total: count() })
      .from(referralsTable)
      .where(and(eq(referralsTable.referrerId, req.userId), sql`${referralsTable.referredUserId} IS NOT NULL`));

    const [{ total: rewardCount }] = await db
      .select({ total: count() })
      .from(referralsTable)
      .where(and(
        eq(referralsTable.referrerId, req.userId),
        eq(referralsTable.rewardApplied, true),
      ));

    res.json({
      referralCode: referral.referralCode,
      referralLink: `${origin}/sign-up?ref=${referral.referralCode}`,
      referredCount: Number(referredCount),
      bonusOrdersEarned: Number(rewardCount) * REFERRAL_BONUS_ORDERS,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /referral/apply
router.post("/referral/apply", requireAuth, async (req: any, res) => {
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Referral code is required" });
  }

  try {
    const [referral] = await db
      .select()
      .from(referralsTable)
      .where(eq(referralsTable.referralCode, code.trim().toUpperCase()));

    if (!referral) return res.status(404).json({ error: "Invalid referral code" });
    if (referral.referrerId === req.userId) return res.status(400).json({ error: "Cannot use your own referral code" });
    if (referral.referredUserId) return res.status(400).json({ error: "Referral code already used" });

    await db
      .update(referralsTable)
      .set({ referredUserId: req.userId, rewardApplied: true })
      .where(eq(referralsTable.id, referral.id));

    const month = getCurrentMonth();
    await db
      .insert(usageTrackingTable)
      .values({ userId: referral.referrerId, month, ordersUsed: 0, bonusOrders: REFERRAL_BONUS_ORDERS })
      .onConflictDoUpdate({
        target: [usageTrackingTable.userId, usageTrackingTable.month],
        set: { bonusOrders: sql`${usageTrackingTable.bonusOrders} + ${REFERRAL_BONUS_ORDERS}`, updatedAt: new Date() },
      });

    const origin = req.headers.origin ?? `https://${req.headers.host}`;
    const newReferral = await getOrCreateReferral(req.userId);

    const [{ total: referredCount }] = await db
      .select({ total: count() })
      .from(referralsTable)
      .where(and(eq(referralsTable.referrerId, req.userId), sql`${referralsTable.referredUserId} IS NOT NULL`));

    const [{ total: rewardCount }] = await db
      .select({ total: count() })
      .from(referralsTable)
      .where(and(eq(referralsTable.referrerId, req.userId), eq(referralsTable.rewardApplied, true)));

    res.json({
      referralCode: newReferral.referralCode,
      referralLink: `${origin}/sign-up?ref=${newReferral.referralCode}`,
      referredCount: Number(referredCount),
      bonusOrdersEarned: Number(rewardCount) * REFERRAL_BONUS_ORDERS,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
