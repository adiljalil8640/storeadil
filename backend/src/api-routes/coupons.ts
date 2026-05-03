import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable, couponsTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { ValidateCouponBody, CreateCouponBody } from "@workspace/api-zod";
import { validate } from "../middlewares/validate";

const router = Router();

async function getStoreForUser(userId: string) {
  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.userId, userId));
  return store ?? null;
}

// POST /coupons/validate — public, no auth
router.post("/coupons/validate", validate(ValidateCouponBody), async (req: any, res) => {
  const { storeId, code, orderAmount } = req.body;

  try {
    const [coupon] = await db
      .select()
      .from(couponsTable)
      .where(
        and(
          eq(couponsTable.storeId, storeId),
          ilike(couponsTable.code, code.trim())
        )
      );

    if (!coupon) return res.json({ valid: false, error: "Coupon not found" });
    if (!coupon.isActive) return res.json({ valid: false, error: "Coupon is inactive" });
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.json({ valid: false, error: "Coupon has expired" });
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return res.json({ valid: false, error: "Coupon usage limit reached" });
    }
    if (coupon.minOrderAmount !== null && orderAmount < Number(coupon.minOrderAmount)) {
      return res.json({
        valid: false,
        error: `Minimum order amount is ${Number(coupon.minOrderAmount).toFixed(2)}`,
      });
    }

    const value = Number(coupon.value);
    let discountAmount = 0;
    if (coupon.type === "percentage") {
      discountAmount = (orderAmount * value) / 100;
    } else {
      discountAmount = Math.min(value, orderAmount);
    }
    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalAmount = Math.max(0, orderAmount - discountAmount);

    res.json({
      valid: true,
      couponId: coupon.id,
      discountType: coupon.type,
      discountValue: value,
      discountAmount,
      finalAmount,
    });
  } catch (err) {
    throw err;
  }
});

// GET /coupons
router.get("/coupons", requireAuth, async (req: any, res) => {
  try {
    const store = await getStoreForUser(req.userId);
    if (!store) return res.json([]);

    const coupons = await db
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.storeId, store.id))
      .orderBy(couponsTable.createdAt);

    res.json(coupons);
  } catch (err) {
    throw err;
  }
});

// POST /coupons
router.post("/coupons", requireAuth, validate(CreateCouponBody), async (req: any, res) => {
  const store = await getStoreForUser(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });

  const { code, type, value, minOrderAmount, maxUses, expiresAt, isActive } = req.body;
  if (!["percentage", "fixed"].includes(type)) {
    return res.status(400).json({ error: "type must be percentage or fixed" });
  }
  if (value <= 0) {
    return res.status(400).json({ error: "value must be a positive number" });
  }
  if (type === "percentage" && value > 100) {
    return res.status(400).json({ error: "Percentage discount cannot exceed 100%" });
  }

  try {
    // Check uniqueness within store
    const [existing] = await db
      .select({ id: couponsTable.id })
      .from(couponsTable)
      .where(and(eq(couponsTable.storeId, store.id), ilike(couponsTable.code, code.trim())));
    if (existing) return res.status(409).json({ error: "A coupon with that code already exists" });

    const [coupon] = await db
      .insert(couponsTable)
      .values({
        storeId: store.id,
        code: code.trim().toUpperCase(),
        type,
        value: String(value),
        minOrderAmount: minOrderAmount ? String(minOrderAmount) : null,
        maxUses: maxUses ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive !== false,
      })
      .returning();

    res.status(201).json(coupon);
  } catch (err) {
    throw err;
  }
});

// PUT /coupons/:id
router.put("/coupons/:id", requireAuth, async (req: any, res) => {
  const store = await getStoreForUser(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });

  const id = parseInt(req.params.id);
  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(and(eq(couponsTable.id, id), eq(couponsTable.storeId, store.id)));
  if (!coupon) return res.status(404).json({ error: "Coupon not found" });

  const { code, type, value, minOrderAmount, maxUses, expiresAt, isActive } = req.body ?? {};

  try {
    const updates: any = {};
    if (code !== undefined) updates.code = code.trim().toUpperCase();
    if (type !== undefined) updates.type = type;
    if (value !== undefined) updates.value = String(value);
    if (minOrderAmount !== undefined) updates.minOrderAmount = minOrderAmount ? String(minOrderAmount) : null;
    if (maxUses !== undefined) updates.maxUses = maxUses ?? null;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db
      .update(couponsTable)
      .set(updates)
      .where(and(eq(couponsTable.id, id), eq(couponsTable.storeId, store.id)))
      .returning();

    res.json(updated);
  } catch (err) {
    throw err;
  }
});

// DELETE /coupons/:id
router.delete("/coupons/:id", requireAuth, async (req: any, res) => {
  const store = await getStoreForUser(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });

  const id = parseInt(req.params.id);
  const [coupon] = await db
    .select({ id: couponsTable.id })
    .from(couponsTable)
    .where(and(eq(couponsTable.id, id), eq(couponsTable.storeId, store.id)));
  if (!coupon) return res.status(404).json({ error: "Coupon not found" });

  try {
    await db
      .delete(couponsTable)
      .where(and(eq(couponsTable.id, id), eq(couponsTable.storeId, store.id)));
    res.status(204).end();
  } catch (err) {
    throw err;
  }
});

export default router;
