import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  connectWebJs,
  disconnectWebJs,
  getSessionStatus,
  sendBusinessApiMessage,
  generateAutoReply,
} from "../services/whatsapp";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
}

async function getStore(userId: string) {
  const [store] = await db.select().from(storesTable).where(eq(storesTable.userId, userId));
  return store ?? null;
}

// ─── WhatsApp Business API webhook (public — no auth) ─────────────────────────

// GET /whatsapp/webhook — Meta challenge verification
router.get("/whatsapp/webhook", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode !== "subscribe" || !token) {
    return res.status(400).json({ error: "Invalid request" });
  }

  // Find a store whose verifyToken matches
  const stores = await db
    .select({ id: storesTable.id, waMode: storesTable.waMode, waBizVerifyToken: storesTable.waBizVerifyToken })
    .from(storesTable);

  const match = stores.find(s => s.waMode === "business-api" && s.waBizVerifyToken === token);

  if (!match) {
    return res.status(403).json({ error: "Verify token mismatch" });
  }

  return res.status(200).send(challenge);
});

// POST /whatsapp/webhook — incoming message from Meta
router.post("/whatsapp/webhook", async (req, res) => {
  res.status(200).send("EVENT_RECEIVED"); // always ACK immediately

  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") return;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        const phoneNumberId: string = value?.metadata?.phone_number_id;

        if (!phoneNumberId) continue;

        // Look up store by phone number ID
        const [store] = await db
          .select()
          .from(storesTable)
          .where(eq(storesTable.waBizPhoneId, phoneNumberId));

        if (!store || !store.waAutoReply || store.waMode !== "business-api") continue;

        for (const msg of value.messages ?? []) {
          if (msg.type !== "text") continue;
          const customerPhone: string = msg.from;
          const text: string = msg.text?.body ?? "";

          if (!text.trim()) continue;

          try {
            const reply = await generateAutoReply(store, text);
            await sendBusinessApiMessage(
              store.waBizPhoneId!,
              store.waBizAccessToken!,
              customerPhone,
              reply,
            );
          } catch (e) {
            req.log?.error({ err: e }, "WA Business API auto-reply failed");
          }
        }
      }
    }
  } catch (e) {
    req.log?.error({ err: e }, "WA webhook processing error");
  }
});

// ─── Store WhatsApp Config (authenticated) ────────────────────────────────────

// GET /stores/me/whatsapp-config
router.get("/stores/me/whatsapp-config", requireAuth, async (req: any, res) => {
  const store = await getStore(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });

  return res.json({
    waMode: store.waMode ?? "none",
    waBizPhoneId: store.waBizPhoneId ?? "",
    waBizAccessToken: store.waBizAccessToken ?? "",
    waBizVerifyToken: store.waBizVerifyToken ?? "",
    waAutoReply: store.waAutoReply ?? false,
    waReplyPrompt: store.waReplyPrompt ?? "",
  });
});

// PUT /stores/me/whatsapp-config
router.put("/stores/me/whatsapp-config", requireAuth, async (req: any, res) => {
  const store = await getStore(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });

  const { waMode, waBizPhoneId, waBizAccessToken, waBizVerifyToken, waAutoReply, waReplyPrompt } = req.body;

  // If switching away from web-js, disconnect any active session
  if (waMode !== "web-js" && store.waMode === "web-js") {
    disconnectWebJs(store.id).catch(() => {});
  }

  await db
    .update(storesTable)
    .set({
      waMode: waMode ?? store.waMode,
      waBizPhoneId: waBizPhoneId ?? store.waBizPhoneId,
      waBizAccessToken: waBizAccessToken ?? store.waBizAccessToken,
      waBizVerifyToken: waBizVerifyToken ?? store.waBizVerifyToken,
      waAutoReply: typeof waAutoReply === "boolean" ? waAutoReply : store.waAutoReply,
      waReplyPrompt: waReplyPrompt ?? store.waReplyPrompt,
      updatedAt: new Date(),
    })
    .where(eq(storesTable.id, store.id));

  return res.json({ success: true });
});

// GET /stores/me/whatsapp-status — poll connection state (web-js)
router.get("/stores/me/whatsapp-status", requireAuth, async (req: any, res) => {
  const store = await getStore(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });

  if (store.waMode !== "web-js") {
    return res.json({ mode: store.waMode ?? "none", status: "disconnected", qrCode: null, phone: null });
  }

  const session = getSessionStatus(store.id);
  return res.json({
    mode: "web-js",
    status: session.status,
    qrCode: session.qrDataUrl,
    phone: session.phone,
  });
});

// POST /stores/me/whatsapp-connect — initiate web-js session
router.post("/stores/me/whatsapp-connect", requireAuth, async (req: any, res) => {
  const store = await getStore(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });
  if (store.waMode !== "web-js") return res.status(400).json({ error: "Mode must be set to WhatsApp Web first" });

  const current = getSessionStatus(store.id);
  if (current.status === "connected") {
    return res.json({ status: "connected", phone: current.phone, qrCode: null });
  }

  // Start connection in background — client polls /whatsapp-status for QR
  connectWebJs(store.id).catch(() => {});

  return res.json({ status: "connecting", qrCode: null, phone: null });
});

// POST /stores/me/whatsapp-disconnect — disconnect web-js session
router.post("/stores/me/whatsapp-disconnect", requireAuth, async (req: any, res) => {
  const store = await getStore(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });

  await disconnectWebJs(store.id);
  return res.json({ success: true });
});

export default router;
