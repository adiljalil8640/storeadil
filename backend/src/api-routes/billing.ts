import { Router } from "express";
import { db } from "@workspace/db";
import { plansTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getOrCreateSubscription, getPlanByName, getStripeClient } from "../services/billing";
import { getUserUsageSummary } from "../services/usage";
import { requireAuth } from "../middlewares/auth";
import { CreateCheckoutSessionBody } from "@workspace/api-zod";
import { validate } from "../middlewares/validate";

const router = Router();

// GET /billing/plans
router.get("/billing/plans", async (req: any, res) => {
  try {
    const plans = await db.select().from(plansTable).orderBy(plansTable.priceMonthly);
    res.json(plans.map(p => ({
      ...p,
      priceMonthly: Number(p.priceMonthly),
      features: (p.features as string[]) ?? [],
    })));
  } catch (err) {
    throw err;
  }
});

// GET /billing/status
router.get("/billing/status", requireAuth, async (req: any, res) => {
  try {
    const { sub } = await getOrCreateSubscription(req.userId);
    const summary = await getUserUsageSummary(req.userId);
    res.json({
      plan: { ...summary.plan, priceMonthly: Number(summary.plan.priceMonthly), features: (summary.plan.features as string[]) ?? [] },
      status: sub.status,
      ordersUsed: summary.ordersUsed,
      ordersLimit: summary.ordersLimit,
      productsUsed: summary.productsUsed,
      productsLimit: summary.productsLimit,
      usagePercent: summary.usagePercent,
      isNearLimit: summary.isNearLimit,
      currentPeriodEnd: sub.currentPeriodEnd ?? null,
    });
  } catch (err) {
    throw err;
  }
});

// POST /billing/checkout
router.post("/billing/checkout", requireAuth, validate(CreateCheckoutSessionBody), async (req: any, res) => {
  const { planName } = req.body;
  if (!["pro", "business"].includes(planName)) {
    return res.status(400).json({ error: "Invalid plan" });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY to enable payments." });
  }

  try {
    const plan = await getPlanByName(planName);
    if (!plan?.stripePriceId) {
      return res.status(400).json({ error: "Plan Stripe price not configured" });
    }

    const origin = req.headers.origin ?? `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      metadata: { userId: req.userId, planName },
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing`,
      client_reference_id: req.userId,
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// POST /billing/portal
router.post("/billing/portal", requireAuth, async (req: any, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured." });
  }

  try {
    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, req.userId));
    if (!sub?.stripeCustomerId) {
      return res.status(400).json({ error: "No Stripe customer found" });
    }

    const origin = req.headers.origin ?? `https://${req.headers.host}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${origin}/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

// POST /billing/webhook
router.post("/billing/webhook", async (req: any, res) => {
  const stripe = getStripeClient();
  if (!stripe) return res.json({ status: "ok" });

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any;
  try {
    event = webhookSecret
      ? stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
      : JSON.parse(req.body);
  } catch (err) {
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const planName = session.metadata?.planName;
      if (!userId || !planName) return res.json({ status: "ok" });

      const plan = await getPlanByName(planName);
      if (!plan) return res.json({ status: "ok" });

      await db
        .insert(subscriptionsTable)
        .values({
          userId,
          planId: plan.id,
          status: "active",
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
        })
        .onConflictDoUpdate({
          target: subscriptionsTable.userId,
          set: {
            planId: plan.id,
            status: "active",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            updatedAt: new Date(),
          },
        });
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const status = sub.status === "active" ? "active" : sub.status === "canceled" ? "canceled" : "past_due";
      await db
        .update(subscriptionsTable)
        .set({ status, currentPeriodEnd: new Date(sub.current_period_end * 1000), updatedAt: new Date() })
        .where(eq(subscriptionsTable.stripeSubscriptionId, sub.id));
    }

    if (event.type === "customer.subscription.deleted" || event.type === "invoice.payment_failed") {
      const obj = event.data.object;
      const stripeSubId = obj.subscription ?? obj.id;
      const freePlan = await getPlanByName("free");
      if (freePlan && stripeSubId) {
        await db
          .update(subscriptionsTable)
          .set({
            planId: freePlan.id,
            status: "canceled",
            stripeSubscriptionId: null,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubId));
      }
    }

    res.json({ status: "ok" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
