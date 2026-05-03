const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || "orders@zappstore.app";

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[email] Resend error:", err);
    }
  } catch (err) {
    console.error("[email] Failed to send email:", err);
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Received",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "#f59e0b",
    confirmed: "#3b82f6",
    completed: "#25D366",
    cancelled: "#ef4444",
  };
  return map[status] ?? "#6b7280";
}

function itemsTable(items: any[], currency: string): string {
  const rows = items.map((item: any) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">${item.productName}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${currency} ${(item.price * item.quantity).toFixed(2)}</td>
    </tr>`).join("");
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="color:#6b7280;">
          <th style="text-align:left;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Item</th>
          <th style="text-align:center;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Qty</th>
          <th style="text-align:right;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function baseTemplate(content: string, storeName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#25D366;padding:24px 32px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:24px;">🛍️</span>
      <span style="color:#ffffff;font-size:18px;font-weight:700;">${storeName}</span>
    </div>
    <div style="padding:32px;">
      ${content}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
      Powered by <strong>Zapp Store</strong> · WhatsApp Store Builder
    </div>
  </div>
</body>
</html>`;
}

export async function sendOrderConfirmation(params: {
  to: string;
  customerName: string | null;
  orderId: number;
  trackingToken: string;
  items: any[];
  total: number;
  currency: string;
  storeName: string;
  deliveryType: string | null;
  appBaseUrl: string;
}): Promise<void> {
  const { to, customerName, orderId, trackingToken, items, total, currency, storeName, deliveryType, appBaseUrl } = params;
  const name = customerName || "there";
  const trackingUrl = `${appBaseUrl}/track/${trackingToken}`;

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Order Confirmed! 🎉</h2>
    <p style="color:#6b7280;margin:0 0 24px;">Hi ${name}, your order #${orderId} has been placed successfully.</p>

    ${itemsTable(items, currency)}

    <div style="margin-top:16px;text-align:right;font-size:16px;font-weight:700;color:#111827;">
      Total: ${currency} ${total.toFixed(2)}
    </div>

    ${deliveryType ? `<p style="margin-top:16px;color:#6b7280;font-size:14px;">Delivery method: <strong>${deliveryType === "delivery" ? "Home Delivery" : "Store Pickup"}</strong></p>` : ""}

    <div style="margin:28px 0;padding:16px;background:#f0fdf4;border-radius:8px;border-left:4px solid #25D366;">
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Track your order anytime:</p>
      <a href="${trackingUrl}" style="color:#25D366;font-weight:600;font-size:14px;word-break:break-all;">${trackingUrl}</a>
    </div>

    <a href="${trackingUrl}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-top:8px;">
      Track My Order →
    </a>

    <p style="margin-top:24px;color:#6b7280;font-size:13px;">
      The store owner will contact you via WhatsApp to confirm and coordinate your order.
    </p>`;

  await sendEmail(to, `Order #${orderId} confirmed — ${storeName}`, baseTemplate(content, storeName));
}

export async function sendStatusUpdateEmail(params: {
  to: string;
  customerName: string | null;
  orderId: number;
  trackingToken: string;
  newStatus: string;
  items: any[];
  total: number;
  currency: string;
  storeName: string;
  appBaseUrl: string;
}): Promise<void> {
  const { to, customerName, orderId, trackingToken, newStatus, items, total, currency, storeName, appBaseUrl } = params;
  const name = customerName || "there";
  const trackingUrl = `${appBaseUrl}/track/${trackingToken}`;
  const label = statusLabel(newStatus);
  const color = statusColor(newStatus);

  const messages: Record<string, string> = {
    confirmed: "Great news! The store has confirmed your order and is getting it ready.",
    completed: "Your order has been completed. We hope you love your purchase! 🎉",
    cancelled: "Unfortunately your order has been cancelled. Please contact the store for more information.",
    pending: "Your order status has been updated.",
  };

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Order Update</h2>
    <p style="color:#6b7280;margin:0 0 20px;">Hi ${name}, here's the latest on your order #${orderId}.</p>

    <div style="margin-bottom:24px;padding:16px 20px;background:#f9fafb;border-radius:8px;display:flex;align-items:center;gap:12px;">
      <span style="display:inline-block;background:${color};color:#fff;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:700;">${label}</span>
      <span style="color:#374151;font-size:14px;">${messages[newStatus] ?? messages.pending}</span>
    </div>

    ${itemsTable(items, currency)}

    <div style="margin-top:16px;text-align:right;font-size:16px;font-weight:700;color:#111827;">
      Total: ${currency} ${total.toFixed(2)}
    </div>

    <a href="${trackingUrl}" style="display:inline-block;margin-top:24px;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      View Order Status →
    </a>`;

  await sendEmail(to, `Order #${orderId} is now ${label} — ${storeName}`, baseTemplate(content, storeName));
}
