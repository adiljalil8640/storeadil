import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Known bot user-agents that crawl for OG/meta tags
const BOT_PATTERN =
  /whatsapp|facebookexternalhit|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|applebot|pinterest|vkshare|w3c_validator|embedly|quora|outbrain|taboola|preview/i;

function isBot(ua: string): boolean {
  return BOT_PATTERN.test(ua);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// GET /api/og/:slug — public, no auth
// Returns an OG-tagged HTML page for social crawlers; browsers are redirected instantly to the real store.
router.get("/og/:slug", async (req: any, res) => {
  const { slug } = req.params;

  try {
    const [store] = await db
      .select({
        name: storesTable.name,
        slug: storesTable.slug,
        description: storesTable.description,
        logoUrl: storesTable.logoUrl,
      })
      .from(storesTable)
      .where(eq(storesTable.slug, slug));

    if (!store) {
      return res.status(404).send("Store not found");
    }

    // Derive origin from request headers (works behind the Replit proxy)
    const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
    const proto = req.headers["x-forwarded-proto"] ?? "https";
    const origin = `${proto}://${host}`;

    const storeUrl = `${origin}/store/${store.slug}`;
    const ogUrl = `${origin}/api/og/${store.slug}`;

    const title = escapeHtml(store.name);
    const description = store.description
      ? escapeHtml(store.description.slice(0, 160))
      : escapeHtml(`Shop ${store.name} on Zapp Store — browse products and order via WhatsApp.`);
    const imageUrl = store.logoUrl ? escapeHtml(store.logoUrl) : "";
    const siteName = "Zapp Store";

    // If it's a browser (not a bot), redirect immediately to the real store URL.
    const ua = req.headers["user-agent"] ?? "";
    if (!isBot(ua)) {
      res.redirect(302, storeUrl);
      return;
    }

    // Serve OG HTML for crawlers
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title} — ${siteName}</title>
  <meta name="description" content="${description}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:url" content="${escapeHtml(storeUrl)}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:alt" content="${title} logo" />` : ""}

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ""}

  <!-- Canonical -->
  <link rel="canonical" href="${escapeHtml(storeUrl)}" />

  <!-- Redirect browsers that somehow land here -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(storeUrl)}" />
  <script>window.location.replace(${JSON.stringify(storeUrl)});</script>
</head>
<body>
  <noscript>
    <p>Redirecting to <a href="${escapeHtml(storeUrl)}">${title}</a>…</p>
  </noscript>
</body>
</html>`);
  } catch (err) {
    req.log.error(err);
    res.status(500).send("Internal server error");
  }
});

export default router;
