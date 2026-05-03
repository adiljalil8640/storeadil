import { useState } from "react";
import { useGetBillingPlans, useGetBillingStatus, useCreateCheckoutSession, useGetMyReferral, useApplyReferralCode } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Zap, Building, Sparkles, Copy, Users, Gift, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PLAN_ICONS: Record<string, any> = {
  free: Sparkles,
  pro: Zap,
  business: Building,
};

export default function BillingPage() {
  const [referralInput, setReferralInput] = useState("");
  const { data: plans, isLoading: plansLoading } = useGetBillingPlans();
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useGetBillingStatus();
  const { data: referral, isLoading: referralLoading, refetch: refetchReferral } = useGetMyReferral();

  const checkout = useCreateCheckoutSession({
    mutation: {
      onSuccess: (data) => { window.location.href = data.url; },
      onError: (err: any) => toast.error(err?.response?.data?.error ?? "Payment not available. Add STRIPE_SECRET_KEY to enable."),
    },
  });

  const applyReferral = useApplyReferralCode({
    mutation: {
      onSuccess: () => {
        toast.success("Referral code applied! The referrer earned 50 bonus orders.");
        setReferralInput("");
        refetchStatus();
        refetchReferral();
      },
      onError: (err: any) => toast.error(err?.response?.data?.error ?? "Invalid code"),
    },
  });

  const currentPlan = status?.plan;
  const usagePercent = status?.usagePercent ?? 0;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
          <p className="text-muted-foreground">Manage your subscription and usage.</p>
        </div>

        {/* Current Usage */}
        {!statusLoading && status && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={status.isNearLimit ? "border-yellow-400" : ""}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Current Plan
                    <Badge variant={currentPlan?.name === "free" ? "secondary" : "default"} className={currentPlan?.name !== "free" ? "bg-primary text-primary-foreground" : ""}>
                      {currentPlan?.displayName}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Your usage this month</CardDescription>
                </div>
                {status.isNearLimit && (
                  <div className="flex items-center gap-1 text-yellow-600 text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    Near limit
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Orders this month</span>
                      <span className="font-medium">
                        {status.ordersUsed} / {currentPlan?.isUnlimited ? "∞" : status.ordersLimit}
                      </span>
                    </div>
                    {!currentPlan?.isUnlimited && (
                      <Progress value={Math.min(usagePercent, 100)} className={`h-2 ${usagePercent >= 80 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-primary"}`} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Products</span>
                      <span className="font-medium">
                        {status.productsUsed} / {currentPlan?.isUnlimited ? "∞" : status.productsLimit}
                      </span>
                    </div>
                    {!currentPlan?.isUnlimited && (
                      <Progress value={Math.min((status.productsUsed / (status.productsLimit || 1)) * 100, 100)} className="h-2 [&>div]:bg-primary" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Plan Cards */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
          {plansLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map(i => <Card key={i} className="h-64 animate-pulse bg-muted" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {plans?.map((plan, idx) => {
                const Icon = PLAN_ICONS[plan.name] ?? Sparkles;
                const isCurrent = currentPlan?.name === plan.name;
                const features = (plan.features as string[]) ?? [];
                return (
                  <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
                    <Card className={`relative flex flex-col h-full ${plan.name === "pro" ? "border-primary shadow-md" : ""} ${isCurrent ? "ring-2 ring-primary" : ""}`}>
                      {plan.name === "pro" && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground px-3">Most Popular</Badge>
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${plan.name === "free" ? "bg-muted" : "bg-primary/10"}`}>
                            <Icon className={`w-4 h-4 ${plan.name === "free" ? "text-muted-foreground" : "text-primary"}`} />
                          </div>
                          <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold">${Number(plan.priceMonthly).toFixed(0)}</span>
                          <span className="text-muted-foreground text-sm">/month</span>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col">
                        <ul className="space-y-2 flex-1">
                          {features.map((feat: string) => (
                            <li key={feat} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                              {feat}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-6">
                          {isCurrent ? (
                            <Button disabled className="w-full" variant="outline">Current Plan</Button>
                          ) : plan.name === "free" ? (
                            <Button disabled className="w-full" variant="outline">Downgrade</Button>
                          ) : (
                            <Button
                              className="w-full"
                              onClick={() => checkout.mutate({ data: { planName: plan.name as "pro" | "business" } })}
                              disabled={checkout.isPending}
                            >
                              {checkout.isPending ? "Redirecting..." : `Upgrade to ${plan.displayName}`}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        {/* Referral Section */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary" />
                Your Referral Code
              </CardTitle>
              <CardDescription>Share your code — earn +50 orders/month per referral</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {referralLoading ? (
                <div className="h-10 animate-pulse bg-muted rounded" />
              ) : referral ? (
                <>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-4 py-2 rounded font-mono text-lg font-bold tracking-widest">
                      {referral.referralCode}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(referral.referralLink);
                        toast.success("Referral link copied!");
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {referral.referredCount} referred
                    </div>
                    <div className="flex items-center gap-1">
                      <Gift className="w-4 h-4" />
                      {referral.bonusOrdersEarned} bonus orders earned
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Apply a Referral Code
              </CardTitle>
              <CardDescription>Enter a friend's code to get started with a bonus</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter referral code..."
                  value={referralInput}
                  onChange={e => setReferralInput(e.target.value.toUpperCase())}
                  className="font-mono tracking-wider"
                />
                <Button
                  onClick={() => applyReferral.mutate({ data: { code: referralInput } })}
                  disabled={!referralInput.trim() || applyReferral.isPending}
                >
                  Apply
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Applying a code credits +50 bonus orders to the person who shared it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
