import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";
import { db } from "@workspace/db";
import { storesTable, productsTable, aiProvidersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";

// ─── Session Registry ─────────────────────────────────────────────────────────

export interface WaSession {
  status: "disconnected" | "connecting" | "qr_pending" | "connected";
  qrDataUrl: string | null;
  phone: string | null;
  sock: ReturnType<typeof makeWASocket> | null;
}

const sessions = new Map<number, WaSession>();

function getSession(storeId: number): WaSession {
  return sessions.get(storeId) ?? { status: "disconnected", qrDataUrl: null, phone: null, sock: null };
}

function setSession(storeId: number, partial: Partial<WaSession>) {
  const current = sessions.get(storeId) ?? { status: "disconnected", qrDataUrl: null, phone: null, sock: null };
  sessions.set(storeId, { ...current, ...partial });
}

export function getSessionStatus(storeId: number): Pick<WaSession, "status" | "qrDataUrl" | "phone"> {
  const s = getSession(storeId);
  return { status: s.status, qrDataUrl: s.qrDataUrl, phone: s.phone };
}

// ─── Session directory per store ──────────────────────────────────────────────

function sessionDir(storeId: number): string {
  const dir = path.join("/tmp", "wa-sessions", String(storeId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Human-like delay ─────────────────────────────────────────────────────────

export function humanDelay(minMs = 1500, maxMs = 4000): Promise<void> {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

// ─── Baileys (web-js) ─────────────────────────────────────────────────────────

export async function connectWebJs(storeId: number): Promise<void> {
  // Clean up any existing session
  const existing = sessions.get(storeId);
  if (existing?.sock) {
    try { await existing.sock.end(undefined); } catch {}
  }

  setSession(storeId, { status: "connecting", qrDataUrl: null, phone: null, sock: null });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir(storeId));
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, undefined as any),
    },
    printQRInTerminal: false,
    syncFullHistory: false,
    browser: ["Zapp Store", "Chrome", "120.0.0"],
  });

  setSession(storeId, { sock });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        setSession(storeId, { status: "qr_pending", qrDataUrl: dataUrl });
      } catch {}
    }

    if (connection === "open") {
      const phone = sock.user?.id?.split(":")[0] ?? null;
      setSession(storeId, { status: "connected", qrDataUrl: null, phone, sock });
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        setSession(storeId, { status: "connecting", sock: null });
        setTimeout(() => connectWebJs(storeId).catch(() => {}), 5000);
      } else {
        setSession(storeId, { status: "disconnected", sock: null, phone: null });
        // Clear saved credentials on logout
        try { fs.rmSync(sessionDir(storeId), { recursive: true, force: true }); } catch {}
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || remoteJid.endsWith("@g.us")) continue; // skip groups

      const text =
        msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        msg.message?.imageMessage?.caption ??
        "";

      if (!text.trim()) continue;

      try {
        const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId));
        if (!store?.waAutoReply) continue;

        const reply = await generateAutoReply(store, text);

        // Simulate human: mark as read, show typing, delay, then send
        await sock.readMessages([msg.key]);
        await sock.sendPresenceUpdate("composing", remoteJid);
        await humanDelay(2000, 5000);
        await sock.sendPresenceUpdate("paused", remoteJid);
        await sock.sendMessage(remoteJid, { text: reply });
      } catch {}
    }
  });
}

export async function disconnectWebJs(storeId: number): Promise<void> {
  const session = sessions.get(storeId);
  if (session?.sock) {
    try { await session.sock.logout(); } catch {}
    try { await session.sock.end(undefined); } catch {}
  }
  sessions.delete(storeId);
  try { fs.rmSync(sessionDir(storeId), { recursive: true, force: true }); } catch {}
}

// ─── WhatsApp Business API ────────────────────────────────────────────────────

export async function sendBusinessApiMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
): Promise<void> {
  await humanDelay(1000, 3000); // human-like delay

  const resp = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "text",
      text: { body: text },
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Business API error: ${JSON.stringify(err)}`);
  }
}

// ─── AI Auto-Reply Generator ──────────────────────────────────────────────────

export async function generateAutoReply(store: any, customerMessage: string): Promise<string> {
  // Get store products for context
  const products = await db
    .select({ name: productsTable.name, price: productsTable.price, description: productsTable.description, stock: productsTable.stock })
    .from(productsTable)
    .where(and(eq(productsTable.storeId, store.id), eq(productsTable.isActive, true)))
    .limit(20);

  const productList = products
    .map(p => `• ${p.name} — ${store.currency} ${Number(p.price).toFixed(2)}${p.description ? ` (${p.description.slice(0, 60)})` : ""}${p.stock === 0 ? " [OUT OF STOCK]" : ""}`)
    .join("\n");

  // Get AI client
  const { client, model } = await getAiClient();

  const systemPrompt = store.waReplyPrompt?.trim() ||
    `You are a helpful WhatsApp sales assistant for "${store.name}". Reply conversationally, warmly, and concisely (2-4 sentences max). Help customers with product info, pricing, and ordering. If they want to order, guide them to complete checkout on the store. Never make up info not listed. Respond in the same language the customer used.`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\nStore: ${store.name}\nCurrency: ${store.currency}\nProducts available:\n${productList || "No products listed yet."}`,
      },
      { role: "user", content: customerMessage },
    ],
    max_tokens: 300,
  });

  return completion.choices[0]?.message?.content?.trim() || "Thanks for reaching out! I'll get back to you shortly.";
}

async function getAiClient(): Promise<{ client: OpenAI; model: string }> {
  try {
    const [provider] = await db
      .select()
      .from(aiProvidersTable)
      .where(and(eq(aiProvidersTable.isDefault, true), eq(aiProvidersTable.isActive, true)))
      .limit(1);

    if (provider) {
      return { client: new OpenAI({ baseURL: provider.baseUrl, apiKey: provider.apiKey }), model: provider.defaultModel };
    }
  } catch {}

  return {
    client: new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    }),
    model: "gpt-4o-mini",
  };
}
