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

export async function sendDigestEmail(params: {
  to: string;
  storeName: string;
  currency: string;
  periodLabel: string;
  frequency: "daily" | "weekly";
  totalOrders: number;
  totalRevenue: number;
  pendingCount: number;
  confirmedCount: number;
  completedCount: number;
  topProducts: { name: string; qty: number; revenue: number }[];
}): Promise<void> {
  const { to, storeName, currency, periodLabel, frequency, totalOrders, totalRevenue, pendingCount, confirmedCount, completedCount, topProducts } = params;

  const subject = frequency === "daily"
    ? `Your daily sales summary — ${storeName}`
    : `Your weekly sales summary — ${storeName}`;

  const topProductsRows = topProducts.length
    ? topProducts.map(p => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;">${p.name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:center;font-size:14px;">${p.qty}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:14px;font-weight:600;">${currency} ${p.revenue.toFixed(2)}</td>
      </tr>`).join("")
    : `<tr><td colspan="3" style="padding:16px 0;text-align:center;color:#9ca3af;font-size:14px;">No sales in this period</td></tr>`;

  const statBox = (label: string, value: string | number, color: string) => `
    <div style="flex:1;min-width:120px;padding:16px;background:${color};border-radius:10px;text-align:center;">
      <div style="font-size:26px;font-weight:800;color:#111827;">${value}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px;">${label}</div>
    </div>`;

  const content = `
    <h2 style="margin:0 0 4px;font-size:22px;color:#111827;">
      ${frequency === "daily" ? "📊 Daily" : "📈 Weekly"} Sales Summary
    </h2>
    <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">${periodLabel}</p>

    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px;">
      ${statBox("Total Orders", totalOrders, "#f0fdf4")}
      ${statBox("Revenue", `${currency} ${totalRevenue.toFixed(2)}`, "#eff6ff")}
      ${statBox("Completed", completedCount, "#f0fdf4")}
    </div>

    ${(pendingCount > 0 || confirmedCount > 0) ? `
    <div style="margin-bottom:24px;padding:12px 16px;background:#fef9c3;border-radius:8px;border-left:4px solid #f59e0b;font-size:13px;color:#78350f;">
      ⏳ <strong>${pendingCount + confirmedCount} order${pendingCount + confirmedCount !== 1 ? "s" : ""}</strong> still awaiting fulfilment
      (${pendingCount} pending, ${confirmedCount} confirmed)
    </div>` : ""}

    <h3 style="margin:0 0 12px;font-size:15px;color:#111827;">Top Products</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="color:#6b7280;font-size:12px;">
          <th style="text-align:left;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Product</th>
          <th style="text-align:center;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Units Sold</th>
          <th style="text-align:right;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Revenue</th>
        </tr>
      </thead>
      <tbody>${topProductsRows}</tbody>
    </table>

    ${totalOrders === 0 ? `
    <div style="margin-top:24px;padding:20px;background:#f9fafb;border-radius:8px;text-align:center;color:#6b7280;font-size:14px;">
      No orders were placed in this period. Keep sharing your store link! 🚀
    </div>` : ""}`;

  await sendEmail(to, subject, baseTemplate(content, storeName));
}

export async function sendBackInStockEmail(params: {
  to: string;
  name: string | null;
  storeName: string;
  productName: string;
  productPrice: number;
  currency: string;
  storeSlug: string;
  appBaseUrl: string;
}): Promise<void> {
  const { to, name, storeName, productName, productPrice, currency, storeSlug, appBaseUrl } = params;

  const price = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(productPrice);
  const storefrontUrl = `${appBaseUrl}/store/${storeSlug}`;

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">🎉 Good news — it's back!</h2>
    <p style="color:#6b7280;margin:0 0 24px;font-size:15px;">
      Hey${name ? ` ${name}` : ""}! You asked us to let you know when <strong>${productName}</strong> came back in stock at <strong>${storeName}</strong>. It's available again — grab it before it sells out.
    </p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:28px;">
      <div style="font-weight:700;font-size:16px;color:#111827;margin-bottom:4px;">${productName}</div>
      <div style="font-size:20px;font-weight:800;color:#25D366;">${price}</div>
    </div>

    <a href="${storefrontUrl}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
      Shop Now →
    </a>

    <p style="margin-top:24px;font-size:12px;color:#9ca3af;">
      You're receiving this because you signed up for back-in-stock alerts at ${storeName}. 
      Stock is limited and available on a first-come, first-served basis.
    </p>`;

  await sendEmail(
    to,
    `✅ ${productName} is back in stock at ${storeName}!`,
    baseTemplate(content, storeName)
  );
}

export async function sendLowStockAlert(params: {
  to: string;
  storeName: string;
  products: { name: string; stock: number; threshold: number; category: string | null }[];
  appBaseUrl: string;
}): Promise<void> {
  const { to, storeName, products, appBaseUrl } = params;

  const rows = products.map(p => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
        <div style="font-weight:600;font-size:14px;color:#111827;">${p.name}</div>
        ${p.category ? `<div style="font-size:12px;color:#9ca3af;">${p.category}</div>` : ""}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:center;">
        <span style="background:#fef2f2;color:#ef4444;padding:3px 10px;border-radius:999px;font-size:13px;font-weight:700;">${p.stock} left</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;color:#6b7280;">
        alert at ≤ ${p.threshold}
      </td>
    </tr>`).join("");

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">⚠️ Low Stock Alert</h2>
    <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">
      ${products.length === 1 ? "1 product is" : `${products.length} products are`} running low at <strong>${storeName}</strong>. Restock soon to keep orders flowing.
    </p>

    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="color:#6b7280;font-size:12px;">
          <th style="text-align:left;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Product</th>
          <th style="text-align:center;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Stock</th>
          <th style="text-align:right;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Threshold</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <a href="${appBaseUrl}/products" style="display:inline-block;margin-top:28px;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      Manage Inventory →
    </a>`;

  const subject = products.length === 1
    ? `Low stock: "${products[0].name}" at ${storeName}`
    : `${products.length} products running low at ${storeName}`;

  await sendEmail(to, subject, baseTemplate(content, storeName));
}

export async function sendNewOrderNotification(params: {
  to: string;
  orderId: number;
  trackingToken: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  items: any[];
  total: number;
  currency: string;
  storeName: string;
  deliveryType: string | null;
  customerNote: string | null;
  appBaseUrl: string;
}): Promise<void> {
  const { to, orderId, trackingToken, customerName, customerEmail, customerPhone, items, total, currency, storeName, deliveryType, customerNote, appBaseUrl } = params;
  const trackingUrl = `${appBaseUrl}/track/${trackingToken}`;

  const deliveryBadge = deliveryType === "delivery"
    ? `<span style="background:#3b82f6;color:#fff;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;">🚚 Delivery</span>`
    : `<span style="background:#8b5cf6;color:#fff;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;">🏪 Pickup</span>`;

  const contactLines = [
    customerName ? `<tr><td style="color:#6b7280;padding:4px 0;font-size:13px;">Name</td><td style="padding:4px 0;font-size:13px;font-weight:600;">${customerName}</td></tr>` : "",
    customerEmail ? `<tr><td style="color:#6b7280;padding:4px 0;font-size:13px;">Email</td><td style="padding:4px 0;font-size:13px;">${customerEmail}</td></tr>` : "",
    customerPhone ? `<tr><td style="color:#6b7280;padding:4px 0;font-size:13px;">Phone</td><td style="padding:4px 0;font-size:13px;">${customerPhone}</td></tr>` : "",
    customerNote ? `<tr><td style="color:#6b7280;padding:4px 0;font-size:13px;vertical-align:top;">Note</td><td style="padding:4px 0;font-size:13px;">${customerNote}</td></tr>` : "",
  ].filter(Boolean).join("");

  const content = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
      <h2 style="margin:0;font-size:22px;color:#111827;">New Order #${orderId} 🎉</h2>
    </div>
    <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">A new order just arrived at <strong>${storeName}</strong>. ${deliveryBadge}</p>

    ${contactLines ? `
    <div style="margin-bottom:20px;padding:14px;background:#f9fafb;border-radius:8px;">
      <table style="border-collapse:collapse;width:100%;">
        ${contactLines}
      </table>
    </div>` : ""}

    ${itemsTable(items, currency)}

    <div style="margin-top:16px;text-align:right;font-size:16px;font-weight:700;color:#111827;">
      Total: ${currency} ${total.toFixed(2)}
    </div>

    ${customerNote ? `<div style="margin-top:16px;padding:12px;background:#fef9c3;border-radius:8px;border-left:4px solid #f59e0b;font-size:13px;color:#78350f;"><strong>Customer note:</strong> ${customerNote}</div>` : ""}

    <div style="margin-top:28px;display:flex;gap:12px;">
      <a href="${trackingUrl}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">
        View Order →
      </a>
      ${customerPhone ? `<a href="https://wa.me/${customerPhone.replace(/\D/g,'')}" style="display:inline-block;background:#fff;border:2px solid #25D366;color:#25D366;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">
        Message Customer →
      </a>` : ""}
    </div>`;

  await sendEmail(to, `New order #${orderId} at ${storeName}`, baseTemplate(content, storeName));
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

export async function sendNewReviewNotification(params: {
  to: string;
  storeName: string;
  productName: string;
  customerName: string | null;
  rating: number;
  comment: string | null;
  appBaseUrl: string;
}): Promise<void> {
  const { to, storeName, productName, customerName, rating, comment, appBaseUrl } = params;

  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const ratingColor = rating >= 4 ? "#25D366" : rating === 3 ? "#f59e0b" : "#ef4444";

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">⭐ New Review Received</h2>
    <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">
      A customer just left a review on <strong>${storeName}</strong>.
    </p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Product</div>
      <div style="font-weight:700;font-size:16px;color:#111827;margin-bottom:12px;">${productName}</div>

      <div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Rating</div>
      <div style="font-size:22px;letter-spacing:2px;color:${ratingColor};margin-bottom:4px;">${stars}</div>
      <div style="font-size:13px;color:#6b7280;margin-bottom:${comment ? "12px" : "0"};">
        ${rating} out of 5${customerName ? ` · by ${customerName}` : ""}
      </div>

      ${comment ? `
      <div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Comment</div>
      <div style="font-size:14px;color:#374151;line-height:1.6;padding:12px;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
        "${comment}"
      </div>` : ""}
    </div>

    <a href="${appBaseUrl}/reviews" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      View &amp; Reply →
    </a>

    <p style="margin-top:20px;font-size:12px;color:#9ca3af;">
      Tip: replying to reviews builds customer trust and can boost future sales.
    </p>`;

  await sendEmail(
    to,
    `New ${rating}★ review for "${productName}" — ${storeName}`,
    baseTemplate(content, storeName)
  );
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
