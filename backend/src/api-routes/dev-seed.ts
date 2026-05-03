import { Router } from "express";
import { db } from "@workspace/db";
import {
  storesTable,
  productsTable,
  ordersTable,
  plansTable,
  subscriptionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// POST /dev/seed — wipe and re-seed test data for the signed-in user (dev only)
// This route is a no-op in production; the guard is checked at request time.
router.post("/dev/seed", requireAuth, async (req: any, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ error: "Not found" });
  }

  const userId = req.userId;

  try {
    // 1. Delete existing store + its data
    const [existing] = await db
      .select({ id: storesTable.id })
      .from(storesTable)
      .where(eq(storesTable.userId, userId));

    if (existing) {
      await db.delete(ordersTable).where(eq(ordersTable.storeId, existing.id));
      await db.delete(productsTable).where(eq(productsTable.storeId, existing.id));
      await db.delete(storesTable).where(eq(storesTable.id, existing.id));
    }

    // 2. Create test store
    const slug = `test-${userId.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
    const [store] = await db
      .insert(storesTable)
      .values({
        userId,
        name: "My Test Store",
        slug,
        description: "A seed store for development testing",
        whatsappNumber: "+1234567890",
        currency: "USD",
        theme: "light",
        deliveryEnabled: true,
        pickupEnabled: true,
        category: "general",
      })
      .returning();

    // 3. Create test products
    const productRows = await db
      .insert(productsTable)
      .values([
        {
          storeId: store.id,
          name: "Classic White Sneakers",
          description: "Comfortable everyday sneakers in white canvas",
          price: "49.99",
          category: "Footwear",
          stock: 25,
          lowStockThreshold: 5,
          isActive: true,
          variants: [],
        },
        {
          storeId: store.id,
          name: "Denim Jacket",
          description: "Stonewashed denim jacket, relaxed fit",
          price: "89.99",
          category: "Clothing",
          stock: 10,
          lowStockThreshold: 3,
          isActive: true,
          variants: [{ label: "Size", options: ["S", "M", "L", "XL"] }] as any,
        },
        {
          storeId: store.id,
          name: "Wireless Earbuds",
          description: "Bluetooth 5.0, 8 h battery, noise isolation",
          price: "29.99",
          category: "Electronics",
          stock: 50,
          lowStockThreshold: 10,
          isActive: true,
          variants: [],
        },
        {
          storeId: store.id,
          name: "Leather Wallet",
          description: "Slim bifold wallet, genuine leather",
          price: "24.99",
          category: "Accessories",
          stock: 0,
          lowStockThreshold: 5,
          isActive: true,
          variants: [],
        },
        {
          storeId: store.id,
          name: "Scented Candle Set",
          description: "Set of 3 hand-poured soy candles — lavender, cedar, vanilla",
          price: "34.99",
          category: "Home",
          stock: 15,
          isActive: false,
          variants: [],
        },
      ])
      .returning();

    // 4. Create test orders
    const [p1, p2, p3] = productRows;
    await db.insert(ordersTable).values([
      {
        storeId: store.id,
        customerName: "Alice Johnson",
        customerEmail: "alice@example.com",
        customerPhone: "+15551110001",
        items: [
          { productId: p1.id, name: p1.name, price: Number(p1.price), qty: 2 },
        ] as any,
        total: (Number(p1.price) * 2).toFixed(2),
        status: "pending",
        deliveryType: "delivery",
      },
      {
        storeId: store.id,
        customerName: "Bob Smith",
        customerEmail: "bob@example.com",
        customerPhone: "+15551110002",
        items: [
          { productId: p2.id, name: p2.name, price: Number(p2.price), qty: 1 },
          { productId: p3.id, name: p3.name, price: Number(p3.price), qty: 1 },
        ] as any,
        total: (Number(p2.price) + Number(p3.price)).toFixed(2),
        status: "confirmed",
        deliveryType: "pickup",
      },
      {
        storeId: store.id,
        customerName: "Carol Davis",
        customerEmail: "carol@example.com",
        customerPhone: "+15551110003",
        items: [
          { productId: p3.id, name: p3.name, price: Number(p3.price), qty: 3 },
        ] as any,
        total: (Number(p3.price) * 3).toFixed(2),
        status: "delivered",
        deliveryType: "delivery",
      },
    ]);

    // 5. Ensure free-plan subscription exists for this user
    const [freePlan] = await db
      .select()
      .from(plansTable)
      .where(eq(plansTable.name, "free"));

    if (freePlan) {
      await db
        .insert(subscriptionsTable)
        .values({ userId, planId: freePlan.id, status: "active" })
        .onConflictDoNothing();
    }

    res.status(201).json({
      message: "Seed complete",
      store: { id: store.id, slug: store.slug, name: store.name },
      products: productRows.length,
      orders: 3,
    });
  } catch (err) {
    throw err;
  }
});

export default router;
