# Zapp Store — Senior Engineer Audit & Handoff Document

**Audited:** 2026-05-03  
**Auditor:** Senior Engineer (AI Agent)  
**Purpose:** Production readiness assessment + task list for the junior engineer

---

## 1. Project Overview

Zapp Store is a **multi-tenant SaaS** that lets merchants create WhatsApp-powered online stores. Customers browse a public storefront and check out by being redirected to WhatsApp with a pre-filled order message.

**Tech stack summary:**

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind v4 + ShadCN UI |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk v6 (whitelabel) |
| Payments | Stripe (optional) |
| Email | Resend (optional) |
| AI | OpenAI-compatible API (dynamic, DB-driven provider) |
| WhatsApp | wa.me link redirect + optional Baileys Web.js + WhatsApp Business API |
| Monorepo | pnpm workspaces |

---

## 2. Architecture

```
Browser → Port 80 → backend (Port 8080)
                       ├── /api/*  → Express API routes (Clerk-protected)
                       └── /*      → Dev proxy → Vite (Port 18973)
```

In **production**, the frontend is built as static files and served separately. The backend only handles `/api/*`.

### Key design decisions

- **One store per user** — `storesTable.userId` is unique. One Clerk user = one store.
- **Bearer token auth** — Clerk's session JWT is sent as `Authorization: Bearer <token>` on every API call. The `ClerkTokenInjector` component in `App.tsx` fetches the token and registers it with the custom fetch layer.
- **Plan limits enforced server-side** — Product and order limits are checked on every create call in the backend. The frontend only shows UI warnings.
- **AI provider fallback chain** — DB default provider → env-based Replit OpenAI integration.
- **Fire-and-forget for side effects** — Emails, stock decrements, and coupon usage increments are done in background `async` IIFEs that do not block the order response.

---

## 3. Production Readiness Verdict

> **Not yet production-ready.** The app is feature-complete and architecturally sound, but has several security holes and reliability gaps that must be fixed before any real users touch it.

---

## 4. Critical Issues (Must Fix Before Launch)

### ~~ISSUE-01 — Admin panel is open to ALL users when `ADMIN_USER_IDS` is not set~~ ✅ FIXED

**File:** `backend/src/api-routes/admin.ts`  
**Severity:** CRITICAL — Security  
**Status:** Fixed 2026-05-03

The guard logic was changed from `ADMIN_USER_IDS.length > 0 && !includes(userId)` to `ADMIN_USER_IDS.length === 0 || !includes(userId)`. Now if the env var is not set, **everyone is denied** rather than everyone being allowed.

**Action still required:** Set `ADMIN_USER_IDS=<your_clerk_user_id>` in environment secrets before deploying, otherwise no one (including you) can access the admin panel.

---

### ~~ISSUE-02 — Stripe webhook accepts unverified events when `STRIPE_WEBHOOK_SECRET` is not set~~ ✅ FIXED

**File:** `backend/src/api-routes/billing.ts`  
**Severity:** CRITICAL — Security  
**Status:** Fixed 2026-05-03

The fallback `JSON.parse(req.body)` path (no signature verification) was removed. The webhook endpoint now returns HTTP 500 immediately if `STRIPE_WEBHOOK_SECRET` is not configured, and always calls `stripe.webhooks.constructEvent()` to verify the Stripe signature before processing any event.

**Action still required:** Set `STRIPE_WEBHOOK_SECRET` in environment secrets. In the Stripe dashboard, create a webhook pointing to `https://your-app.replit.app/api/billing/webhook` and copy the signing secret it generates.

---

### ISSUE-03 — CORS is set to reflect any origin

**File:** `backend/src/app.ts`, line 51  
**Severity:** HIGH — Security

```ts
app.use(cors({ credentials: true, origin: true }));
// "origin: true" reflects whatever Origin header the browser sends
```

**Impact:** Any website can make credentialed cross-origin requests to your API. This is fine with Bearer token auth (cookies aren't used), but it is still bad practice and could enable some attack vectors.

**Fix:** Lock CORS to your actual deployed domain.

```ts
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  credentials: true,
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
}));
```

Set `ALLOWED_ORIGINS=https://your-app.replit.app` in environment secrets.

---

### ISSUE-04 — AI provider API keys are stored as plaintext in the database

**File:** `db/src/schema/ai_providers.ts`, `backend/src/api-routes/admin.ts`  
**Severity:** HIGH — Security

The `aiProvidersTable.apiKey` column stores third-party API keys (OpenAI, Groq, etc.) as plain varchar. If the database is ever dumped or exposed, all AI provider keys are leaked.

**Fix (short-term):** Encrypt the `apiKey` field before inserting and decrypt after reading, using a symmetric key stored in an environment secret (`AI_KEY_ENCRYPTION_SECRET`).

**Fix (long-term):** Use a secrets manager (e.g. Vault, AWS Secrets Manager). For now, the short-term fix is sufficient.

---

### ISSUE-05 — WhatsApp Business access token stored as plaintext in `stores` table

**File:** `db/src/schema/stores.ts`, `backend/src/api-routes/whatsapp.ts`  
**Severity:** HIGH — Security

`stores.waBizAccessToken` holds a long-lived Facebook system user access token. This never expires unless revoked and gives full access to the merchant's WhatsApp Business account.

**Fix:** Same as ISSUE-04 — encrypt at rest before writing to the database.

---

### ISSUE-06 — Hardcoded RSA public key in `app.ts` will break if Clerk rotates its signing key

**File:** `backend/src/app.ts`, lines 102–118  
**Severity:** HIGH — Reliability

**Background:** This was added as a workaround because `CLERK_SECRET_KEY` belongs to a different Clerk instance than `VITE_CLERK_PUBLISHABLE_KEY`. The `jwtKey` PEM is the RSA public key for the correct Clerk instance.

**Current state:** Works correctly right now because the PEM matches the instance that issued the tokens.

**Risk:** If Clerk ever rotates the signing key for this instance, ALL user requests will start failing with 401 and the app will be completely broken until a developer manually updates the PEM.

**Proper fix:** Replace `CLERK_SECRET_KEY` with the secret key from the **same** Clerk instance as `VITE_CLERK_PUBLISHABLE_KEY`. Once the keys match, remove the `jwtKey` override from `clerkMiddleware`. Ask the person who originally set up Clerk for the correct secret key.

**How to identify the correct secret key:** In your Clerk dashboard for the `good-whippet-84.clerk.accounts.dev` instance, go to API Keys. The `sk_test_...` key there is the correct one.

---

### ISSUE-07 — `customer-history` endpoint fetches all orders in memory

**File:** `backend/src/api-routes/orders.ts`, lines 428–470  
**Severity:** MEDIUM — Performance

```ts
// This fetches every single order for the store, then filters in JavaScript
const allOrders = await db.select().from(ordersTable).where(eq(ordersTable.storeId, storeId));
const customerOrders = allOrders.filter(o => o.customerPhone === phone || o.customerEmail === email);
```

**Impact:** A store with 10,000 orders will fetch all 10,000 rows from the DB and filter them in memory. This will be very slow and memory-intensive.

**Fix:** Push the filter into SQL.

```ts
import { or } from "drizzle-orm";
const conditions = [eq(ordersTable.storeId, storeId)];
const customerFilter = [];
if (phone) customerFilter.push(eq(ordersTable.customerPhone, phone));
if (email) customerFilter.push(eq(ordersTable.customerEmail, email));
conditions.push(or(...customerFilter)!);
const customerOrders = await db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt));
```

---

### ISSUE-08 — No rate limiting on admin routes

**File:** `backend/src/api-routes/admin.ts`  
**Severity:** MEDIUM — Security

Admin routes have no rate limiter. An authenticated admin can hammer `GET /admin/users` or `POST /admin/ai-providers/test` (which makes external API calls) indefinitely.

**Fix:** Import and apply a rate limiter to all admin routes.

```ts
import { rateLimit } from "express-rate-limit";
const adminLimiter = rateLimit({ windowMs: 60_000, limit: 60 });
router.use(adminLimiter);
```

---

## 5. Medium Issues (Fix Before Scale)

### ISSUE-09 — `console.error` in email service instead of structured logger

**File:** `backend/src/services/email.ts`, lines 16–21  
**Severity:** MEDIUM — Observability

The email service uses `console.error` instead of the pino logger. Email failures will not appear in structured logs or any log aggregation tool.

**Fix:** Import `logger` from `../lib/logger` and replace `console.error(...)` with `logger.error({ err }, "...")`.

---

### ISSUE-10 — WhatsApp Web.js sessions stored in `/tmp`

**File:** `backend/src/services/whatsapp.ts`, line 44  
**Severity:** MEDIUM — Reliability

```ts
const dir = path.join("/tmp", "wa-sessions", String(storeId));
```

`/tmp` is ephemeral. Every time the server restarts (deployments, crashes, scaling), all WhatsApp Web sessions are lost. Merchants will need to re-scan the QR code every time.

**Fix:** Store session files in an Object Storage bucket (Replit provides this). Read the `object-storage` skill and migrate session reads/writes to persistent storage.

---

### ISSUE-11 — `@whiskeysockets/baileys` is a release candidate (RC) package

**File:** `backend/package.json`

```json
"@whiskeysockets/baileys": "7.0.0-rc.9"
```

RC packages are not stable. The Baileys library also causes the backend bundle to be ~9MB, which is very large.

**Recommendation:** If WhatsApp Web.js mode is not being actively marketed, consider removing Baileys entirely and only supporting the Business API mode. This would reduce bundle size and remove the RC dependency.

---

### ISSUE-12 — `dev/seed` route is registered in all environments

**File:** `backend/src/api-routes/dev-seed.ts`, line 18  

The route is correctly guarded at request time (`if (process.env.NODE_ENV !== "development") return 404`), but it still appears in the route table in production. This is not a security issue but is sloppy.

**Fix:** Conditionally register the router in `index.ts`.

```ts
// In backend/src/api-routes/index.ts
if (process.env.NODE_ENV === "development") {
  router.use(devSeedRouter);
}
```

---

### ISSUE-13 — Order status `"delivered"` exists in seed data but not in valid status enum

**File:** `backend/src/api-routes/dev-seed.ts`, line 152  
**File:** `backend/src/api-routes/orders.ts`, line 501  

The dev seed creates an order with `status: "delivered"`, but the valid statuses enforced in `PATCH /orders/:id` are `["pending", "confirmed", "completed", "cancelled"]`. `"delivered"` is not a valid status.

**Fix:** Change the seed data to use `"completed"` instead of `"delivered"`.

---

### ISSUE-14 — `getAiClient()` silently falls back on DB errors

**File:** `backend/src/ai-brain/index.ts`, lines 26–28

```ts
} catch {
  // fall through to env fallback
}
```

If the database is down or misconfigured, AI calls silently fall back to the env-based provider without logging anything. Administrators will not know the DB-configured provider is being bypassed.

**Fix:** Log the error before falling through.

```ts
} catch (err) {
  logger.warn({ err }, "getAiClient: DB provider lookup failed, falling back to env provider");
}
```

---

### ISSUE-15 — `GET /orders` has no offset/cursor pagination

**File:** `backend/src/api-routes/orders.ts`, line 50

```ts
.limit(parseInt(limit as string) || 50);
```

There is a `limit` param but no `offset` or cursor. The merchant dashboard cannot page through orders beyond the first 50. Stores with heavy order volume will always see a truncated view.

**Fix:** Add `offset` query param support.

```ts
const offset = parseInt(req.query.offset as string) || 0;
// ... .limit(parsedLimit).offset(offset)
```

---

## 6. Low Issues / Code Quality

### ISSUE-16 — Widespread use of `req: any` in route handlers

**Files:** Almost all route files in `backend/src/api-routes/`

Route handlers are typed as `async (req: any, res)` which bypasses TypeScript completely for the request object.

**Fix (gradual):** Create a typed `AuthedRequest` interface (already exists in `auth.ts`) and use it in route handlers.

---

### ISSUE-17 — `try { ... } catch (err) { throw err; }` is redundant

**Files:** Most route handlers

Many handlers wrap everything in `try/catch` and rethrow, which is equivalent to having no try/catch at all. The error handler middleware catches all unhandled errors anyway.

**Fix:** Remove the wrapping `try/catch` blocks from route handlers that don't need them. Only use try/catch when you want to handle the error differently (e.g. catch `err.code === "23505"` for unique constraint violations).

---

### ISSUE-18 — `billing.ts` uses `require()` for Stripe inside a function

**File:** `backend/src/services/billing.ts`, line 87

```ts
const Stripe = require("stripe");
```

This uses CommonJS `require` inside an ES module. It works with the current esbuild setup, but it's inconsistent with the rest of the codebase which uses ES imports.

**Fix:** Move the Stripe import to the top of the file.

```ts
import Stripe from "stripe";
```

---

## 7. Environment Variables Checklist

### Required (app will not work without these)

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Auto-provisioned by Replit |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| `CLERK_PUBLISHABLE_KEY` | Same value as above |
| `CLERK_SECRET_KEY` | **Must be from the SAME Clerk instance as the publishable key** (see ISSUE-06) |

### Required for security (set before any real users)

| Variable | Purpose |
|---|---|
| `ADMIN_USER_IDS` | Comma-separated Clerk user IDs with admin access. If not set, ALL users are admins (ISSUE-01). |
| `ALLOWED_ORIGINS` | Your deployed domain, e.g. `https://your-app.replit.app` (ISSUE-03) |

### Required for payments (set before enabling billing)

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret — MANDATORY for security (ISSUE-02) |
| `STRIPE_PRICE_PRO` | Stripe price ID for the Pro plan |
| `STRIPE_PRICE_BUSINESS` | Stripe price ID for the Business plan |

### Optional (feature-gated if missing)

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Transactional emails. Silently skipped if not set. |
| `EMAIL_FROM` | From address for emails (default: `orders@zappstore.app`) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Fallback AI provider base URL |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Fallback AI provider key |

---

## 8. Deployment Checklist

Before deploying to production, complete these steps in order:

- [ ] **Fix ISSUE-01** — Change admin guard logic so empty `ADMIN_USER_IDS` blocks all users
- [ ] **Set `ADMIN_USER_IDS`** — Add your Clerk user ID to environment secrets
- [ ] **Fix ISSUE-02** — Make `STRIPE_WEBHOOK_SECRET` required when Stripe is enabled
- [ ] **Set `STRIPE_WEBHOOK_SECRET`** — In Stripe dashboard, create a webhook endpoint pointing to `https://your-app.replit.app/api/billing/webhook` and copy the signing secret
- [ ] **Fix ISSUE-03** — Lock CORS to your deployed domain
- [ ] **Set `ALLOWED_ORIGINS`** — Your `.replit.app` domain
- [ ] **Address ISSUE-06** — Either get the correct `CLERK_SECRET_KEY` or document the key rotation procedure clearly
- [ ] **Run `pnpm --filter @workspace/db run migrate`** — Ensure all DB migrations are applied
- [ ] **Verify `/api/healthz` returns `{ status: "ok" }`** after deployment
- [ ] **Send a test order** through the public storefront to verify the full flow works
- [ ] **Set `RESEND_API_KEY`** if email notifications are needed

---

## 9. What Works Well

These parts of the codebase are solid and do not need changes:

- **Authentication flow** — Clerk integration with Bearer token injection is clean. Auto-signout on 401 is in place.
- **Database connection hardening** — Pool caps, statement timeouts, idle timeouts, and pool error logging are all configured correctly in `db/src/index.ts`.
- **Health endpoint** — `/api/healthz` is registered before Clerk middleware so it always responds, even when auth is broken.
- **Error handler** — Centralized error handler with structured logging, userId, storeId context, and response time.
- **Rate limiting** — Public order creation (20/15min), public storefront (120/min), tracking (30/min), and public writes (10/min) are all rate limited.
- **Plan limits** — Product and order limits enforced server-side on every create. Clients cannot bypass by manipulating the UI.
- **Graceful shutdown** — SIGTERM/SIGINT handled with a 10-second force-kill fallback.
- **Coupon validation** — Expiry, max uses, min order amount, and case-insensitive code matching are all checked server-side.
- **Slug uniqueness** — Enforced at the DB level with a unique constraint (`23505` error caught and returned as 409).
- **Order tracking tokens** — UUID-based tracking tokens are validated with a regex before hitting the DB.
- **Type safety on the API boundary** — Zod validation schemas are auto-generated from the OpenAPI spec via Orval, and input validation runs on every mutating endpoint.

---

## 10. Key File Map for the Junior Engineer

```
backend/src/
  app.ts                     ← Middleware stack. Order matters. Read this first.
  index.ts                   ← HTTP server, graceful shutdown, digest scheduler start
  api-routes/
    index.ts                 ← All routers registered here
    stores.ts                ← Store CRUD, domain, slug, hours, holidays
    products.ts              ← Product CRUD, plan limit checks, stock updates
    orders.ts                ← Order create (public), order management (authed), CSV export
    billing.ts               ← Stripe checkout, portal, webhook handler
    admin.ts                 ← Admin stats, user plan override, AI provider CRUD
    whatsapp.ts              ← WhatsApp webhook, Baileys session, Business API config
    dev-seed.ts              ← Dev-only test data seeder (dev only, returns 404 in prod)
  middlewares/
    auth.ts                  ← requireAuth, requireStore middleware
    rateLimiter.ts           ← All rate limiter instances
    errorHandler.ts          ← Centralized error handler
    clerkProxyMiddleware.ts  ← Clerk FAPI proxy (prod only)
    validate.ts              ← Generic Zod validation middleware
  services/
    billing.ts               ← Plan definitions, seedPlans, Stripe client factory
    usage.ts                 ← Plan limit checks, usage increment
    email.ts                 ← All transactional email templates (Resend)
    whatsapp.ts              ← Baileys Web.js session management, Business API sender
    digest.ts                ← Daily/weekly digest scheduler
  ai-brain/
    index.ts                 ← AI router: generate-store, generate-description, suggest-price
  lib/
    logger.ts                ← Pino logger instance
    health.ts                ← DB liveness check, pool stats

frontend/src/
  App.tsx                    ← Route tree, Clerk provider, auth token injector
  pages/
    landing.tsx              ← Public landing page
    onboarding.tsx           ← 3-step store creation flow
    dashboard.tsx            ← Main merchant dashboard
    products.tsx             ← Product management
    orders.tsx               ← Order management
    settings.tsx             ← Store settings, WhatsApp config, digest
    analytics.tsx            ← Charts and KPIs
    billing.tsx              ← Plan selection and Stripe redirect
    admin.tsx                ← Admin panel
    storefront.tsx           ← Public customer-facing store
    track.tsx                ← Public order tracking page

db/src/schema/              ← One file per DB table
lib/
  api-client-react/src/
    custom-fetch.ts          ← The fetch layer: auth token injection, 401 callback
    generated/               ← Auto-generated from OpenAPI spec (do not edit manually)
  api-spec/                  ← OpenAPI spec (source of truth for API shape)
```

---

## 11. Common Development Commands

```bash
# Start everything (normally done by Replit workflows)
pnpm --filter @workspace/api-server run dev     # backend on port 8080
pnpm --filter @workspace/store-builder run dev  # frontend on port 18973

# TypeScript check
pnpm run typecheck

# Rebuild backend after changes (the workflow does this automatically on restart)
cd backend && node ./build.mjs

# Database migrations
pnpm --filter @workspace/db run generate   # generate new migration from schema changes
pnpm --filter @workspace/db run migrate    # apply pending migrations
pnpm --filter @workspace/db run check      # verify migration consistency

# Regenerate API client from OpenAPI spec (run after changing api-spec/openapi.yaml)
pnpm --filter @workspace/api-spec run codegen
```

---

## 12. How to Add a New API Endpoint (Step-by-Step)

1. **Add the route** to the appropriate file in `backend/src/api-routes/` (or create a new file and register it in `index.ts`).
2. **Add Zod schema** for the request body in `lib/api-spec/` or `lib/api-zod/src/` if it is a new shape.
3. **Update the OpenAPI spec** (`lib/api-spec/openapi.yaml`) to document the new endpoint.
4. **Run codegen**: `pnpm --filter @workspace/api-spec run codegen` — this auto-generates the React Query hook in `lib/api-client-react/src/generated/`.
5. **Use the generated hook** in the frontend page component.
6. **Rebuild and restart** the backend workflow.

---

## 13. Issue Priority Summary

| Priority | Issues | Action |
|---|---|---|
| ✅ Fixed | ISSUE-01, ISSUE-02 | Security holes — now patched in code |
| Fix before launch | ISSUE-03, ISSUE-04, ISSUE-05, ISSUE-06 | Security and reliability risks |
| Fix before scale | ISSUE-07, ISSUE-08, ISSUE-09, ISSUE-10 | Performance and observability |
| Fix when time allows | ISSUE-11 through ISSUE-18 | Code quality and maintainability |
