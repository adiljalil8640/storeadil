import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable, whatsappMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  connectWebJs,
  disconnectWebJs,
  getSessionStatus,
  sendBusinessApiMessage,
  generateAutoReply,
} from "../services/whatsapp";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getStore(userId: string) {
  const [store] = await db.select().from(storesTable).where(eq(storesTable.userId, userId));
  return store ?? null;
}

router.get("/whatsapp/webhook", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode !== "subscribe" || !token) return res.status(400).json({ error: "Invalid request" });
  const stores = await db.select({ waMode: storesTable.waMode, waBizVerifyToken: storesTable.waBizVerifyToken }).from(storesTable);
  const match = stores.find(s => s.waMode === "business-api" && s.waBizVerifyToken === token);
  if (!match) return res.status(403).json({ error: "Verify token mismatch" });
  return res.status(200).send(challenge);
});

router.post("/whatsapp/webhook", async (req, res) => {
  res.status(200).send("EVENT_RECEIVED");
  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") return;
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;
        const [store] = await db.select().from(storesTable).where(eq(storesTable.waBizPhoneId, phoneNumberId));
        if (!store || !store.waAutoReply || store.waMode !== "business-api") continue;
        for (const msg of value.messages ?? []) {
          if (msg.type !== "text") continue;
          const customerPhone = msg.from;
          const text = msg.text?.body ?? "";
          if (!text.trim()) continue;
          try {
            const reply = await generateAutoReply(store, text);
            await db.insert(whatsappMessagesTable).values({
              storeId: store.id,
              mode: "business-api",
              customerPhone,
              customerMessage: text,
              aiReply: reply,
              source: "business-api",
            });
            await sendBusinessApiMessage(store.waBizPhoneId!, store.waBizAccessToken!, customerPhone, reply);
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

router.put("/stores/me/whatsapp-config", requireAuth, async (req: any, res) => {
  const store = await getStore(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });
  const { waMode, waBizPhoneId, waBizAccessToken, waBizVerifyToken, waAutoReply, waReplyPrompt } = req.body;
  if (waMode !== "web-js" && store.waMode === "web-js") disconnectWebJs(store.id).catch(() => {});
  await db.update(storesTable).set({
    waMode: waMode ?? store.waMode,
    waBizPhoneId: waBizPhoneId ?? store.waBizPhoneId,
    waBizAccessToken: waBizAccessToken ?? store.waBizAccessToken,
    waBizVerifyToken: waBizVerifyToken ?? store.waBizVerifyToken,
    waAutoReply: typeof waAutoReply === "boolean" ? waAutoReply : store.waAutoReply,
    waReplyPrompt: waReplyPrompt ?? store.waReplyPrompt,
    updatedAt: new Date(),
  }).where(eq(storesTable.id, store.id));
  return res.json({ success: true });
});

router.get("/stores/me/whatsapp-status", requireAuth, async (req: any, res) => {
  const store = await getStore(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });
  if (store.waMode !== "web-js") return res.json({ mode: store.waMode ?? "none", status: "disconnected", qrCode: null, phone: null });
  const session = getSessionStatus(store.id);
  return res.json({ mode: "web-js", status: session.status, qrCode: session.qrDataUrl, phone: session.phone });
});

router.post("/stores/me/whatsapp-connect", requireAuth, async (req: any, res) => {
  const store = await getStore(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });
  if (store.waMode !== "web-js") return res.status(400).json({ error: "Mode must be set to WhatsApp Web first" });
  const current = getSessionStatus(store.id);
  if (current.status === "connected") return res.json({ status: "connected", phone: current.phone, qrCode: null });
  connectWebJs(store.id).catch(() => {});
  return res.json({ status: "connecting", qrCode: null, phone: null });
});

router.post("/stores/me/whatsapp-disconnect", requireAuth, async (req: any, res) => {
  const store = await getStore(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });
  await disconnectWebJs(store.id);
  return res.json({ success: true });
});

router.get("/stores/me/whatsapp-messages", requireAuth, async (req: any, res) => {
  const store = await getStore(req.userId);
  if (!store) return res.status(404).json({ error: "Store not found" });
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
  const messages = await db.select().from(whatsappMessagesTable).where(eq(whatsappMessagesTable.storeId, store.id)).orderBy(desc(whatsappMessagesTable.createdAt)).limit(limit);
  return res.json(messages);
});

export default router;
