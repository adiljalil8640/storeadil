import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /growth/share-message
router.get("/growth/share-message", requireAuth, async (req: any, res) => {
  try {
    const [store] = await db.select().from(storesTable).where(eq(storesTable.userId, req.userId));
    if (!store) return res.status(404).json({ error: "No store found" });

    const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
    const proto = req.headers["x-forwarded-proto"] ?? "https";
    const origin = `${proto}://${host}`;
    const storeUrl = `${origin}/store/${store.slug}`;
    const ogUrl = `${origin}/api/og/${store.slug}`;
    const message = `🛍️ Check out my store *${store.name}* on Zapp Store!\n\nBrowse and order directly via WhatsApp: ${storeUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    res.json({ message, whatsappUrl, storeUrl, ogUrl });
  } catch (err) {
    throw err;
  }
});

// GET /growth/qr-code
router.get("/growth/qr-code", requireAuth, async (req: any, res) => {
  try {
    const [store] = await db.select().from(storesTable).where(eq(storesTable.userId, req.userId));
    if (!store) return res.status(404).json({ error: "No store found" });

    const origin = req.headers.origin ?? `https://${req.headers.host}`;
    const storeUrl = `${origin}/store/${store.slug}`;

    const qrBuffer = await QRCode.toBuffer(storeUrl, {
      type: "png",
      width: 400,
      margin: 2,
      color: { dark: "#111827", light: "#FFFFFF" },
    });

    res.set("Content-Type", "image/png");
    res.set("Content-Disposition", `attachment; filename="${store.slug}-qr.png"`);
    res.send(qrBuffer);
  } catch (err) {
    throw err;
  }
});

export default router;
