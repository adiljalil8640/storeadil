import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import {
  useGetAnalyticsSummary,
  useGetRecentOrders,
  useGetTopProducts,
  useListMerchantReviews,
  useListCoupons,
  useListProducts,
  useGetTopCustomers,
  useGetMyStore,
  useUpdateRevenueGoal,
  getGetMyStoreQueryKey,
  useGetAnalyticsRevenueTrend,
  useGetWhatsappMessages,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign, ShoppingBag, ShoppingCart, Clock, Star, Tag,
  Users, Target, Pencil, Check, X, MessageCircle, AlertTriangle, TrendingUp,
  Copy, ExternalLink, QrCode, Download,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout";
import { motion } from "framer-motion";
import { Link } from "wouter";

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`rounded-xl p-2.5 ${color ?? "bg-primary/10 text-primary"}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_COLORS: Record<string, string> = {
  completed: "hsl(var(--primary))",
  pending: "hsl(var(--chart-3))",
  processing: "hsl(var(--chart-2))",
  cancelled: "hsl(var(--destructive))",
};

export default function Dashboard() {
  const { data: analytics, isLoading: analyticsLoading } = useGetAnalyticsSummary();
  const { data: recentOrders = [], isLoading: ordersLoading } = useGetRecentOrders({ limit: 5 });
  const { data: topProducts = [], isLoading: productsLoading } = useGetTopProducts({ limit: 5 });
  const { data: reviews = [] } = useListMerchantReviews();
  const { data: coupons = [] } = useListCoupons();
  const { data: allProducts = [] } = useListProducts();
  const { data: topCustomers = [] } = useGetTopCustomers({ limit: 8 });
  const { data: store } = useGetMyStore();
  const { data: revenueTrend = [] } = useGetAnalyticsRevenueTrend();
  const { data: waMessages = [] } = useGetWhatsappMessages(
    { limit: 5 },
    { query: { enabled: !!store } }
  );
  const queryClient = useQueryClient();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [stockAlertDismissed, setStockAlertDismissed] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const storeUrl = store?.slug
    ? `${window.location.origin}/store/${store.slug}`
    : null;

  function copyStoreLink() {
    if (!storeUrl) return;
    navigator.clipboard.writeText(storeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const generateQr = useCallback(async (url: string) => {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
    });
    setQrDataUrl(dataUrl);
  }, []);

  useEffect(() => {
    if (qrOpen && storeUrl) {
      generateQr(storeUrl);
    }
  }, [qrOpen, storeUrl, generateQr]);

  function downloadQr() {
    if (!qrDataUrl || !store?.slug) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${store.slug}-qr-code.png`;
    a.click();
  }

  const updateGoal = useUpdateRevenueGoal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyStoreQueryKey() });
        setEditingGoal(false);
      },
    },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: store?.currency ?? "USD" }).format(amount);

  const totalReviews = reviews.length;
  const avgRating = totalReviews
    ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / totalReviews
    : null;

  const lowStockProducts = allProducts.filter(
    (p: any) => p.stock != null && p.lowStockThreshold != null && p.stock <= p.lowStockThreshold
  );

  const revenueGoal = store?.monthlyRevenueGoal ? parseFloat(store.monthlyRevenueGoal) : null;
  const currentRevenue = analytics?.totalRevenue ?? 0;
  const goalPct = revenueGoal && revenueGoal > 0 ? Math.min(100, (currentRevenue / revenueGoal) * 100) : null;

  const orderStatusData = [
    { name: "Completed", value: analytics?.completedOrders ?? 0, color: STATUS_COLORS.completed },
    { name: "Pending", value: analytics?.pendingOrders ?? 0, color: STATUS_COLORS.pending },
  ];

  const couponPerformance = coupons
    .filter((c: any) => c.usedCount > 0)
    .sort((a: any, b: any) => b.usedCount - a.usedCount)
    .slice(0, 5);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your store's performance.</p>
          </div>
          {storeUrl && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={copyStoreLink}
                className="gap-1.5"
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copied!</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> Copy store link</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQrOpen(true)}
                className="gap-1.5"
              >
                <QrCode className="h-3.5 w-3.5" />
                QR Code
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="gap-1.5"
              >
                <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View store
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* Low-stock alert banner */}
        {!stockAlertDismissed && lowStockProducts.length > 0 && (
          <motion.div {...fadeUp}>
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {lowStockProducts.length === 1
                    ? "1 product is running low on stock"
                    : `${lowStockProducts.length} products are running low on stock`}
                </p>
                <p className="text-xs text-amber-700 mt-0.5 truncate">
                  {lowStockProducts.map((p: any) => p.name).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href="/products">
                  <Button variant="outline" size="sm" className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-50 text-amber-900">
                    Manage stock
                  </Button>
                </Link>
                <button
                  onClick={() => setStockAlertDismissed(true)}
                  className="text-amber-500 hover:text-amber-700 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* KPI Cards */}
        <motion.div
          {...fadeUp}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <KpiCard
            icon={<DollarSign className="h-5 w-5" />}
            label="Total Revenue"
            value={analyticsLoading ? "—" : formatCurrency(currentRevenue)}
            sub={analytics?.revenueGrowth != null ? `${analytics.revenueGrowth > 0 ? "+" : ""}${analytics.revenueGrowth.toFixed(1)}% vs last month` : undefined}
            color="bg-emerald-100 text-emerald-700"
          />
          <KpiCard
            icon={<ShoppingCart className="h-5 w-5" />}
            label="Total Orders"
            value={analyticsLoading ? "—" : (analytics?.totalOrders ?? 0)}
            sub={`${analytics?.pendingOrders ?? 0} pending`}
            color="bg-blue-100 text-blue-700"
          />
          <KpiCard
            icon={<Star className="h-5 w-5" />}
            label="Avg Rating"
            value={avgRating != null ? avgRating.toFixed(1) : "—"}
            sub={totalReviews ? `${totalReviews} review${totalReviews !== 1 ? "s" : ""}` : "No reviews yet"}
            color="bg-amber-100 text-amber-700"
          />
          <KpiCard
            icon={<Tag className="h-5 w-5" />}
            label="Active Coupons"
            value={coupons.filter((c: any) => c.isActive).length}
            sub={`${coupons.length} total`}
            color="bg-violet-100 text-violet-700"
          />
        </motion.div>

        {/* Revenue Trend + Order Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div {...fadeUp} className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Revenue Trend (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-52">
                {revenueTrend.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No revenue data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrend}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => format(new Date(d), "MMM d")}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `$${v}`}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip
                        formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                        labelFormatter={(l) => format(new Date(l), "MMM d, yyyy")}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#revGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  Order Status
                </CardTitle>
              </CardHeader>
              <CardContent className="h-52">
                {analyticsLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={orderStatusData} barCategoryGap="40%">
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {orderStatusData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Revenue Goal */}
        {(revenueGoal != null || store) && (
          <motion.div {...fadeUp}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Target className="h-4 w-4 text-primary" />
                    Monthly Revenue Goal
                  </CardTitle>
                  {!editingGoal && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setGoalInput(revenueGoal?.toString() ?? "");
                        setEditingGoal(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingGoal ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-40"
                    />
                    <Button
                      size="sm"
                      onClick={() =>
                        updateGoal.mutate({ data: { goal: parseFloat(goalInput) } })
                      }
                      disabled={updateGoal.isPending}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingGoal(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : revenueGoal != null ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatCurrency(currentRevenue)} earned
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(revenueGoal)} goal
                      </span>
                    </div>
                    <Progress value={goalPct ?? 0} className="h-3" />
                    <p className="text-xs text-muted-foreground">
                      {goalPct?.toFixed(0)}% of monthly goal reached
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No revenue goal set.{" "}
                    <button
                      className="underline text-primary"
                      onClick={() => { setGoalInput(""); setEditingGoal(true); }}
                    >
                      Set one now
                    </button>
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Products */}
          <motion.div {...fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  Top Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
                ) : topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((p: any, i: number) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.orderCount} sold</p>
                        </div>
                        <span className="text-sm font-semibold">{formatCurrency(p.totalRevenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Customers */}
          <motion.div {...fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4 text-primary" />
                  Top Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topCustomers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                ) : (
                  <div className="space-y-3">
                    {topCustomers.slice(0, 5).map((c: any) => (
                      <div key={c.key} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.name || c.phone || c.key}</p>
                          <p className="text-xs text-muted-foreground">{c.orderCount} orders</p>
                        </div>
                        <span className="text-sm font-semibold whitespace-nowrap">
                          {formatCurrency(c.totalSpend)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Orders */}
          <motion.div {...fadeUp}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4 text-primary" />
                  Recent Orders
                </CardTitle>
                <Link href="/orders">
                  <Button variant="ghost" size="sm" className="text-xs">View all</Button>
                </Link>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
                ) : recentOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order: any) => (
                      <div key={order.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {order.customerName || order.customerPhone}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.createdAt), "MMM d, p")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="secondary"
                            className="capitalize text-xs"
                          >
                            {order.status}
                          </Badge>
                          <span className="text-sm font-semibold">
                            {formatCurrency(parseFloat(order.total))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Coupon Performance */}
          <motion.div {...fadeUp}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Tag className="h-4 w-4 text-primary" />
                  Coupon Performance
                </CardTitle>
                <Link href="/coupons">
                  <Button variant="ghost" size="sm" className="text-xs">Manage</Button>
                </Link>
              </CardHeader>
              <CardContent>
                {couponPerformance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No coupons used yet.</p>
                ) : (
                  <div className="space-y-3">
                    {couponPerformance.map((c: any) => (
                      <div key={c.id} className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.code}
                        </Badge>
                        <div className="flex-1 text-xs text-muted-foreground">
                          {c.discountType === "percent"
                            ? `${c.discountValue}% off`
                            : `${formatCurrency(c.discountValue)} off`}
                        </div>
                        <span className="text-xs font-semibold">
                          {c.usedCount}× used
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Low Stock Alerts */}
        {lowStockProducts.length > 0 && (
          <motion.div {...fadeUp}>
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Low Stock Alerts ({lowStockProducts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {lowStockProducts.map((p: any) => (
                    <Link key={p.id} href="/products">
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-700 dark:text-amber-400 cursor-pointer hover:bg-amber-100"
                      >
                        {p.name} — {p.stock} left
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* WhatsApp Messages */}
        <motion.div {...fadeUp}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <MessageCircle className="h-4 w-4 text-[#25D366]" />
                Recent WhatsApp Messages
              </CardTitle>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="text-xs">Configure</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {waMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No WhatsApp conversations yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {waMessages.map((m: any) => (
                    <div key={m.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span className="font-medium">{m.customerPhone}</span>
                        <span>{format(new Date(m.createdAt), "MMM d, p")}</span>
                      </div>
                      <p className="font-medium">👤 {m.customerMessage}</p>
                      <p className="text-muted-foreground mt-1">🤖 {m.aiReply}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              Store QR Code
            </DialogTitle>
            <DialogDescription>
              Customers can scan this to visit your store instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Store QR Code"
                className="rounded-xl border shadow-sm w-56 h-56"
              />
            ) : (
              <div className="w-56 h-56 rounded-xl border bg-muted flex items-center justify-center">
                <QrCode className="h-10 w-10 text-muted-foreground animate-pulse" />
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center break-all px-2">{storeUrl}</p>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={copyStoreLink}
              >
                {copied ? (
                  <><Check className="h-4 w-4 text-emerald-600" /> Copied!</>
                ) : (
                  <><Copy className="h-4 w-4" /> Copy link</>
                )}
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={downloadQr}
                disabled={!qrDataUrl}
              >
                <Download className="h-4 w-4" />
                Download PNG
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
