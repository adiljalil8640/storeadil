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
- **AI**: OpenAI via Replit AI Integrations
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
4. **Product Management** — Full CRUD with categories, stock tracking, image URLs
5. **AI Product Tools** — "AI Description" button generates descriptions; "AI Price" button suggests pricing
6. **Public Storefront** — `/store/:slug` — customer-facing page with product browsing, cart, WhatsApp checkout
7. **WhatsApp Orders** — Checkout generates a pre-filled WhatsApp message and redirects to `wa.me/<phone>?text=...`
8. **Dashboard** — Revenue/order analytics, recent orders, top products, Recharts visualizations
9. **Analytics Page** — Detailed 30-day orders+revenue area chart, top products table
10. **Order Management** — Order tracking with status updates (pending/confirmed/completed/cancelled)
11. **Settings** — WhatsApp number, currency, theme, delivery/pickup toggles, QR code download, WhatsApp share button
12. **Billing & Plans** — Free/Pro/Business plan cards, Stripe checkout integration, usage progress bars
13. **Referral System** — Unique referral codes, referral link sharing, bonus orders for referrers
14. **Admin Panel** — `/admin` — platform stats, user table, per-user plan override
15. **Growth Features** — QR code PNG download, pre-written WhatsApp share message

## Database Schema

- `stores` — one store per user (userId from Clerk), slug for public URL
- `products` — linked to store, with JSONB variants field
- `orders` — linked to store, JSONB items array, customer contact info
- `plans` — Free / Pro / Business plan definitions (seeded on startup)
- `subscriptions` — per-user active plan (defaults to free)
- `usage_tracking` — monthly order count per user
- `referrals` — referral codes, referrer/referee relationships, bonus credits

## API Routes

All routes prefixed with `/api`:
- `/stores/me` — GET/PUT authenticated user's store
- `/stores` — POST create store
- `/stores/public/:slug` — GET public store + products (no auth)
- `/products` — GET list / POST create
- `/products/:id` — GET / PUT / DELETE
- `/products/categories` — GET distinct categories
- `/orders` — GET list / POST create (public, usage-tracked)
- `/orders/:id` — GET / PATCH status
- `/ai/generate-store` — POST AI store generation
- `/ai/generate-description` — POST AI product description
- `/ai/suggest-price` — POST AI price suggestion
- `/analytics/summary` — GET revenue/order stats
- `/analytics/recent-orders` — GET recent orders
- `/analytics/top-products` — GET best-selling products
- `/analytics/orders-per-day` — GET 30-day daily order+revenue series
- `/billing/plans` — GET all plans (public)
- `/billing/status` — GET current user plan + usage
- `/billing/checkout` — POST create Stripe checkout session
- `/billing/portal` — POST create Stripe billing portal session
- `/billing/webhook` — POST Stripe webhook handler
- `/referral/my` — GET my referral code + stats
- `/referral/apply` — POST apply a referral code
- `/admin/stats` — GET platform-wide stats
- `/admin/users` — GET all users with plan/usage
- `/admin/users/:userId/plan` — PUT override a user's plan
- `/growth/qr-code` — GET QR code PNG for user's store
- `/growth/share-message` — GET pre-written WhatsApp share message

## Environment Variables (Auto-Provisioned)

- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
- `SESSION_SECRET`

## Optional Environment Variables (User-Configured)

- `STRIPE_SECRET_KEY` — enables Stripe checkout (returns 503 if missing)
- `STRIPE_PRICE_PRO` — Stripe price ID for Pro plan
- `STRIPE_PRICE_BUSINESS` — Stripe price ID for Business plan
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `ADMIN_USER_IDS` — comma-separated Clerk user IDs with admin access (if empty, all users can access /admin)
