# Zapp Store — WhatsApp Store Builder

## Overview

A multi-tenant SaaS platform where merchants create online stores and customers order via WhatsApp. Built on a pnpm monorepo with React+Vite frontend and Express backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind v4 + ShadCN UI (at `/`)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: Clerk (whitelabel, Replit-managed)
- **AI**: Dynamic multi-provider (OpenAI-compatible) — configured from Admin panel, fallback to Replit AI integration
- **Payments**: Stripe (optional — requires env vars)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Features

1. **Auth** — Clerk-powered sign-in/sign-up with WhatsApp green branding
2. **AI Store Generation** — Describe your business → AI generates store name, categories, and sample products
3. **3-Step Onboarding** — Describe business → review AI output → launch store
4. **Product Management** — Full CRUD with categories, stock tracking, image URLs, bulk CSV import
5. **AI Product Tools** — "AI Description" button generates descriptions; "AI Price" button suggests pricing
6. **Inventory Health** — 4-tile clickable filter (Healthy/Low Stock/Out of Stock/No tracking), bulk restock dialog
7. **Public Storefront** — `/store/:slug` — customer-facing page with product browsing, cart, WhatsApp checkout
8. **WhatsApp Orders** — Checkout generates a pre-filled WhatsApp message and redirects to `wa.me/<phone>?text=...`
9. **Dashboard** — Revenue/order analytics, recent orders, top products, revenue goal tracker, top customers, Recharts visualizations
10. **Analytics Page** — Summary KPIs, orders-per-day area chart with AOV overlay, order heatmap, coupon leaderboard, revenue by day-of-week, revenue trend, customer insights
11. **Order Management** — Order tracking with status updates (pending/confirmed/completed/cancelled), bulk status, CSV export, owner notes
12. **Coupons** — CRUD, percentage/fixed, min-order, max-uses, expiry, storefront validation, performance leaderboard
13. **Reviews** — Customer submission, star rating, merchant reply, email notification
14. **Waitlist** — Per-product waitlist, bulk email notify, back-in-stock email
15. **Settings** — WhatsApp number, currency, theme, delivery/pickup toggles, QR code download, WhatsApp share, custom domain, digest email, store hours, holiday closures
16. **Billing & Plans** — Free/Pro/Business plan cards, Stripe checkout integration, usage progress bars
17. **Referral System** — Unique referral codes, referral link sharing, bonus orders for referrers (reward delivered via usageTracking)
18. **Admin Panel** — `/admin` — platform stats, user table, per-user plan override, **AI provider manager**
19. **Multi-Model AI Manager** — Admin can add/edit/delete/test AI providers (OpenAI, Gemini, Groq, OpenRouter, DeepSeek, HuggingFace, Custom). Default provider used for all AI calls; falls back to env-based OpenAI integration.
20. **Growth Features** — QR code PNG download, pre-written WhatsApp share message, OG image endpoint
21. **Order Tracking** — Public `/track/:token` page; customers see real-time order status timeline without logging in
22. **Email Notifications** — Resend-powered transactional emails; order confirm, status-update, low stock alert, digest (daily/weekly), back-in-stock, new review (gated on `RESEND_API_KEY` env var)

## Database Schema

- `stores` — one store per user (userId from Clerk), slug for public URL
- `products` — linked to store, with JSONB variants field, stock/lowStockThreshold
- `orders` — linked to store, JSONB items array, customer contact info, tracking token
- `plans` — Free / Pro / Business plan definitions (seeded on startup)
- `subscriptions` — per-user active plan (defaults to free). Downgraded to free on Stripe cancellation/payment failure.
- `usage_tracking` — monthly order count + bonus orders per user
- `referrals` — referral codes, referrer/referee relationships, bonus credits
- `coupons` — percentage/fixed discount codes with usage tracking
- `reviews` — product reviews linked to orders, with merchant reply
- `stock_waitlist` — per-product email waitlist for out-of-stock items
- `ai_providers` — dynamic AI provider config: name, provider type, baseUrl, apiKey, defaultModel, isActive, isDefault

## API Routes

All routes prefixed with `/api`. Key routes:

### Stores
- `GET/PUT /stores/me` — authenticated user's store
- `POST /stores` — create store
- `GET /stores/public/:slug` — public store + products (no auth)
- `PATCH /stores/me/hours|holidays|slug|domain|revenue-goal|temporarily-closed` — partial updates

### Products
- `GET/POST /products` — list / create (plan-limited)
- `PUT/DELETE /products/:id` — update / delete
- `POST /products/import` — bulk CSV import

### Orders
- `GET/POST /orders` — list / create
- `PATCH /orders/:id` — update status/note
- `POST /orders/bulk-status` — bulk status update
- `GET /orders/export` — CSV export
- `GET /orders/track/:token` — public tracking (no auth)

### AI
- `POST /ai/generate-store` — AI store generation (uses dynamic provider)
- `POST /ai/generate-description` — AI product description
- `POST /ai/suggest-price` — AI price suggestion

### Analytics
- `GET /analytics/summary|recent-orders|top-products|orders-per-day|order-heatmap|coupon-performance|revenue-trend|revenue-by-day|customer-insights|top-customers|product-velocity`

### Admin
- `GET /admin/stats|users` — platform overview
- `PATCH /admin/users/:userId/plan` — override user plan
- `GET/POST /admin/ai-providers` — list / create AI providers
- `PUT/DELETE /admin/ai-providers/:id` — update / delete
- `PATCH /admin/ai-providers/:id/default` — set default provider
- `POST /admin/ai-providers/test` — test connection

### Billing
- `GET /billing/plans|status` — plan list / user usage
- `POST /billing/checkout|portal|webhook` — Stripe integration

### Other
- `GET/POST /coupons`, `POST /coupons/validate`
- `GET/POST /reviews`, `PATCH /reviews/:id/reply`
- `GET /referral/me`, `POST /referral/apply`
- `GET /growth/qr-code|share-message`
- `GET/POST /waitlist routes`

## Environment Variables (Auto-Provisioned)

- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` (fallback if no DB provider set)
- `SESSION_SECRET`

## Optional Environment Variables (User-Configured)

- `STRIPE_SECRET_KEY` — enables Stripe checkout (returns 503 if missing)
- `STRIPE_PRICE_PRO` — Stripe price ID for Pro plan
- `STRIPE_PRICE_BUSINESS` — Stripe price ID for Business plan
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `RESEND_API_KEY` — enables transactional emails (silent no-op if missing)
- `ADMIN_USER_IDS` — comma-separated Clerk user IDs with admin access (if empty, all users can access /admin)

## Architecture Notes

- AI provider priority: DB default provider → env-based OpenAI fallback
- All AI providers must be OpenAI API-compatible (works with OpenAI, Gemini via OpenAI-compat, Groq, OpenRouter, DeepSeek, HuggingFace inference)
- Billing webhook: `checkout.session.completed` activates plan; `customer.subscription.deleted` + `invoice.payment_failed` downgrade to free
- Plan limits enforced server-side on product create and order create
- Referral rewards credited as `bonusOrders` in `usage_tracking` for the referrer's current month
