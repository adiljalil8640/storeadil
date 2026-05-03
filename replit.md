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
- **AI**: OpenAI via Replit AI Integrations (for store generation)
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
4. **Product Management** — Full CRUD with categories, variants (size/color), stock tracking, image URLs
5. **Public Storefront** — `/store/:slug` — customer-facing page with product browsing, cart, and WhatsApp checkout
6. **WhatsApp Orders** — Checkout generates a pre-filled WhatsApp message and redirects to `wa.me/<phone>?text=...`
7. **Dashboard** — Revenue/order analytics, recent orders, top products, Recharts visualizations
8. **Order Management** — Order tracking with status updates (pending/confirmed/completed/cancelled)
9. **Settings** — WhatsApp number, currency, theme, delivery/pickup toggles

## Database Schema

- `stores` — one store per user (userId from Clerk), slug for public URL
- `products` — linked to store, with JSONB variants field
- `orders` — linked to store, JSONB items array, customer contact info

## API Routes

All routes prefixed with `/api`:
- `/stores/me` — GET/PUT authenticated user's store
- `/stores` — POST create store
- `/stores/public/:slug` — GET public store + products (no auth)
- `/products` — GET list / POST create
- `/products/:id` — GET / PUT / DELETE
- `/products/categories` — GET distinct categories
- `/orders` — GET list / POST create (public)
- `/orders/:id` — GET / PATCH status
- `/ai/generate-store` — POST AI store generation
- `/analytics/summary` — GET revenue/order stats
- `/analytics/recent-orders` — GET recent orders
- `/analytics/top-products` — GET best-selling products

## Environment Variables (Auto-Provisioned)

- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
- `SESSION_SECRET`
