import { useState } from "react";
import { useGetAnalyticsSummary, useGetOrdersPerDay, useGetTopProducts, useGetMyReferral, useGetOrderHeatmap, useGetCouponPerformance, useGetRevenueByDay } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, ShoppingCart, Package, TrendingUp, Download, Share2, Users, Zap, ChevronRight, Clock, Tag, Percent, CheckCircle2, XCircle, AlertCircle, CalendarDays } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { motion } from "framer-motion";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg p-3 shadow-sm text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-medium" style={{ color: p.color }}>
          {p.name}: {p.dataKey === "revenue" ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const { data: summary, isLoading: summaryLoading } = useGetAnalyticsSummary();
  const { data: ordersPerDay, isLoading: chartLoading } = useGetOrdersPerDay();
  const { data: topProducts, isLoading: topLoading } = useGetTopProducts({ limit: 10 });
  const { data: referral, isLoading: referralLoading } = useGetMyReferral();
  const { data: heatmapData = [], isLoading: heatmapLoading } = useGetOrderHeatmap();
  const { data: couponPerf = [], isLoading: couponLoading } = useGetCouponPerformance();
  const { data: revenueByDay = [], isLoading: revByDayLoading } = useGetRevenueByDay();

  const chartData = (ordersPerDay ?? []).map((d) => ({
    date: format(new Date(d.date + "T00:00:00"), "MMM d"),
    orders: d.orders,
    revenue: Number(d.revenue),
  }));

  const today         = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [exportFrom, setExportFrom] = useState(thirtyDaysAgo);
  const [exportTo,   setExportTo]   = useState(today);
  const [exporting,  setExporting]  = useState(false);

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await fetch(`${basePath}/api/orders/export?from=${exportFrom}&to=${exportTo}`);
      if (!r.ok) { toast.error("Export failed — please try again."); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `orders-${exportFrom}-to-${exportTo}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error("Export failed — please try again."); }
    finally { setExporting(false); }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Detailed insights into your store's performance.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Revenue", value: summaryLoading ? "..." : formatCurrency(summary?.totalRevenue ?? 0), sub: `${formatCurrency(summary?.revenueThisMonth ?? 0)} this month`, icon: DollarSign },
            { label: "Total Orders", value: summaryLoading ? "..." : summary?.totalOrders ?? 0, sub: `${summary?.ordersThisMonth ?? 0} this month`, icon: ShoppingCart },
            { label: "Completed", value: summaryLoading ? "..." : summary?.completedOrders ?? 0, sub: `${summary?.pendingOrders ?? 0} pending`, icon: TrendingUp },
            { label: "Active Products", value: summaryLoading ? "..." : summary?.activeProducts ?? 0, sub: `Out of ${summary?.totalProducts ?? 0} total`, icon: Package },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground">{kpi.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* CSV Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              Export Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={exportFrom}
                  max={exportTo}
                  onChange={(e) => setExportFrom(e.target.value)}
                  className="h-9 w-40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={exportTo}
                  min={exportFrom}
                  max={today}
                  onChange={(e) => setExportTo(e.target.value)}
                  className="h-9 w-40"
                />
              </div>
              <Button size="sm" className="gap-2 h-9" disabled={exporting} onClick={handleExport}>
                {exporting
                  ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                  : <Download className="w-3.5 h-3.5" />}
                {exporting ? "Exporting…" : "Download CSV"}
              </Button>
              <p className="text-xs text-muted-foreground self-center">
                One row per line item · includes a revenue-by-product summary at the bottom
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Orders Per Day - Area Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Orders &amp; Revenue — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area yAxisId="left" type="monotone" dataKey="orders" name="Orders" stroke="hsl(var(--primary))" fill="url(#colorOrders)" strokeWidth={2} dot={false} />
                    <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" fill="url(#colorRevenue)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products by Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {topLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : !topProducts?.length ? (
              <div className="text-center py-8 text-muted-foreground">No sales data yet. Share your store to get started!</div>
            ) : (
              <div className="space-y-0">
                <div className="grid grid-cols-12 text-xs text-muted-foreground pb-2 border-b font-medium">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-3 text-right">Orders</div>
                  <div className="col-span-3 text-right">Revenue</div>
                </div>
                {topProducts.map((p, idx) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="grid grid-cols-12 py-3 border-b last:border-0 items-center"
                  >
                    <div className="col-span-6 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4">#{idx + 1}</span>
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight">{p.name}</p>
                        {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                      </div>
                    </div>
                    <div className="col-span-3 text-right text-sm font-medium">{p.orderCount}</div>
                    <div className="col-span-3 text-right text-sm font-medium">{formatCurrency(p.totalRevenue)}</div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {/* Referral Conversion Funnel */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" />
                Referral Conversion Funnel
              </CardTitle>
              <Link href="/referrals" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Manage →
              </Link>
            </CardHeader>
            <CardContent>
              {referralLoading ? (
                <div className="text-center text-muted-foreground py-6">Loading...</div>
              ) : (() => {
                const referred = referral?.referredCount ?? 0;
                const bonus = referral?.bonusOrdersEarned ?? 0;

                const stages = [
                  {
                    icon: Share2,
                    label: "Link created",
                    sublabel: "Your referral link is live",
                    value: null,
                    badge: "Active",
                    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                    barPct: 100,
                    barColor: "bg-primary",
                  },
                  {
                    icon: Users,
                    label: "Merchants joined",
                    sublabel: "Signed up using your link",
                    value: referred,
                    badge: null,
                    badgeColor: "",
                    barPct: referred === 0 ? 4 : 65,
                    barColor: "bg-violet-500",
                  },
                  {
                    icon: Zap,
                    label: "Bonus orders unlocked",
                    sublabel: "50 orders per successful referral",
                    value: bonus,
                    badge: null,
                    badgeColor: "",
                    barPct: bonus === 0 ? 4 : 40,
                    barColor: "bg-amber-500",
                  },
                ];

                return (
                  <div className="space-y-5">
                    {/* Funnel bars */}
                    <div className="space-y-3">
                      {stages.map((stage, i) => (
                        <div key={stage.label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                <stage.icon className="w-3 h-3 text-muted-foreground" />
                              </div>
                              <div>
                                <span className="text-sm font-medium">{stage.label}</span>
                                <span className="text-xs text-muted-foreground ml-2">{stage.sublabel}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {stage.badge ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage.badgeColor}`}>
                                  {stage.badge}
                                </span>
                              ) : (
                                <span className="text-sm font-bold tabular-nums">{stage.value}</span>
                              )}
                            </div>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${stage.barColor}`}
                              style={{ width: `${stage.barPct}%` }}
                            />
                          </div>
                          {i < stages.length - 1 && (
                            <div className="flex items-center gap-1 mt-2 ml-8">
                              <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                              {i === 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {referred === 0
                                    ? "No signups yet — share your link!"
                                    : `${referred} merchant${referred !== 1 ? "s" : ""} converted`}
                                </span>
                              )}
                              {i === 1 && referred > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {bonus} bonus orders earned ({referred} × 50)
                                </span>
                              )}
                              {i === 1 && referred === 0 && (
                                <span className="text-xs text-muted-foreground">Bonus orders unlock on first referral</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Summary strip */}
                    <div className="flex items-center justify-between pt-3 border-t text-sm">
                      <span className="text-muted-foreground">
                        Your code: <span className="font-mono font-semibold text-foreground">{referral?.referralCode ?? "—"}</span>
                      </span>
                      {referred === 0 ? (
                        <Link href="/referrals">
                          <span className="text-xs text-primary hover:underline cursor-pointer">Share your link →</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-xs">{referred} referral{referred !== 1 ? "s" : ""} · {bonus} bonus orders</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </motion.div>
      {/* Order Heatmap */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Order Activity Heatmap
            </CardTitle>
            <span className="text-xs text-muted-foreground">Orders by day &amp; hour</span>
          </CardHeader>
          <CardContent>
            {heatmapLoading ? (
              <div className="text-center text-muted-foreground py-10 text-sm">Loading heatmap…</div>
            ) : (() => {
              const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              const HOURS = Array.from({ length: 24 }, (_, i) => i);
              const HOUR_LABELS: Record<number, string> = {
                0: "12a", 3: "3a", 6: "6a", 9: "9a",
                12: "12p", 15: "3p", 18: "6p", 21: "9p",
              };

              // Build lookup: [day][hour] = count
              const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
              for (const cell of heatmapData) {
                grid[cell.dayOfWeek][cell.hour] = cell.count;
              }
              const maxCount = Math.max(...heatmapData.map((c) => c.count), 1);
              const totalOrders = heatmapData.reduce((s, c) => s + c.count, 0);

              // Find the busiest slot
              let busiestDay = 0, busiestHour = 0;
              for (const cell of heatmapData) {
                if (cell.count === maxCount) { busiestDay = cell.dayOfWeek; busiestHour = cell.hour; }
              }
              const fmt12 = (h: number) => {
                const suffix = h < 12 ? "am" : "pm";
                const h12 = h % 12 === 0 ? 12 : h % 12;
                return `${h12}${suffix}`;
              };

              if (totalOrders === 0) {
                return <div className="text-center text-muted-foreground py-10 text-sm">No orders yet — the heatmap will populate as orders come in.</div>;
              }

              return (
                <div className="space-y-4">
                  {/* Insight strip */}
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2 flex flex-wrap gap-x-6 gap-y-1">
                    <span>Busiest slot: <span className="font-semibold text-foreground">{DAYS[busiestDay]} {fmt12(busiestHour)}</span></span>
                    <span>Peak orders: <span className="font-semibold text-foreground">{maxCount}</span></span>
                    <span>Total orders plotted: <span className="font-semibold text-foreground">{totalOrders}</span></span>
                  </div>

                  {/* Grid */}
                  <div className="overflow-x-auto">
                    <div className="min-w-[560px]">
                      {/* Hour axis */}
                      <div className="flex mb-1 ml-10">
                        {HOURS.map((h) => (
                          <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground leading-none">
                            {HOUR_LABELS[h] ?? ""}
                          </div>
                        ))}
                      </div>

                      {/* Rows */}
                      {DAYS.map((day, d) => (
                        <div key={d} className="flex items-center gap-0 mb-[3px]">
                          <span className="w-10 text-[11px] text-muted-foreground text-right pr-2 shrink-0">{day}</span>
                          {HOURS.map((h) => {
                            const count = grid[d][h];
                            const intensity = count > 0 ? Math.max(0.1, count / maxCount) : 0;
                            return (
                              <div key={h} className="flex-1 group relative">
                                <div
                                  className="h-5 rounded-[3px] mx-[1px] transition-transform duration-150 group-hover:scale-110 cursor-default"
                                  style={{
                                    backgroundColor: count > 0
                                      ? `rgba(37, 211, 102, ${0.15 + intensity * 0.85})`
                                      : "rgba(0,0,0,0.04)",
                                  }}
                                />
                                {count > 0 && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 hidden group-hover:block pointer-events-none">
                                    <div className="bg-popover border text-popover-foreground text-[11px] rounded-md px-2 py-1 shadow-md whitespace-nowrap">
                                      <span className="font-semibold">{day} {fmt12(h)}</span>
                                      <span className="text-muted-foreground ml-1">— {count} order{count !== 1 ? "s" : ""}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      {/* Legend */}
                      <div className="flex items-center gap-2 mt-3 ml-10">
                        <span className="text-[10px] text-muted-foreground">Less</span>
                        {[0.04, 0.2, 0.4, 0.6, 0.8, 1].map((a, i) => (
                          <div
                            key={i}
                            className="h-3 w-5 rounded-sm"
                            style={{
                              backgroundColor: a === 0.04
                                ? "rgba(0,0,0,0.04)"
                                : `rgba(37,211,102,${0.15 + a * 0.85})`,
                            }}
                          />
                        ))}
                        <span className="text-[10px] text-muted-foreground">More</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </motion.div>

      {/* Coupon Performance Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              Coupon Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {couponLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : couponPerf.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No coupons created yet.</p>
                <p className="text-xs mt-1">
                  <Link href="/coupons" className="text-primary underline underline-offset-2">Create your first coupon</Link> to start tracking performance.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Code</th>
                      <th className="text-left py-2 pr-4 font-medium">Type</th>
                      <th className="text-right py-2 pr-4 font-medium">Discount</th>
                      <th className="text-right py-2 pr-4 font-medium">Uses</th>
                      <th className="text-right py-2 pr-4 font-medium">Est. discount given</th>
                      <th className="text-left py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {couponPerf.map((c) => {
                      const statusBadge = (() => {
                        if (!c.isActive) return { label: "Inactive", cls: "bg-muted text-muted-foreground", icon: <XCircle className="w-3 h-3" /> };
                        if (c.expired)   return { label: "Expired",  cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <AlertCircle className="w-3 h-3" /> };
                        if (c.maxedOut)  return { label: "Maxed out",cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <AlertCircle className="w-3 h-3" /> };
                        return { label: "Active", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle2 className="w-3 h-3" /> };
                      })();

                      const usageBar = c.maxUses
                        ? Math.min(100, Math.round((c.usedCount / c.maxUses) * 100))
                        : null;

                      return (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-4">
                            <span className="font-mono font-semibold tracking-wide text-foreground bg-muted px-2 py-0.5 rounded text-xs">
                              {c.code}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              {c.type === "percentage"
                                ? <><Percent className="w-3 h-3" /> Percentage</>
                                : <><DollarSign className="w-3 h-3" /> Fixed</>}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right font-medium">
                            {c.type === "percentage"
                              ? `${c.value}%`
                              : formatCurrency(c.value)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-semibold">{c.usedCount}</span>
                              {usageBar !== null && (
                                <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${usageBar}%` }}
                                  />
                                </div>
                              )}
                              {c.maxUses && (
                                <span className="text-[10px] text-muted-foreground">of {c.maxUses}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right text-muted-foreground">
                            {c.estimatedDiscount != null
                              ? <span className="text-foreground font-medium">{formatCurrency(c.estimatedDiscount)}</span>
                              : <span className="text-xs italic">— (% coupon)</span>}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
                              {statusBadge.icon}
                              {statusBadge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Summary row */}
                {couponPerf.length > 0 && (() => {
                  const totalUses = couponPerf.reduce((s, c) => s + c.usedCount, 0);
                  const totalDiscount = couponPerf.reduce((s, c) => s + (c.estimatedDiscount ?? 0), 0);
                  return (
                    <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                      <span>{couponPerf.length} coupon{couponPerf.length !== 1 ? "s" : ""} total · {couponPerf.filter(c => c.isActive && !c.expired && !c.maxedOut).length} active</span>
                      <span>
                        {totalUses} total redemption{totalUses !== 1 ? "s" : ""}
                        {totalDiscount > 0 && <> · <span className="font-medium text-foreground">{formatCurrency(totalDiscount)}</span> est. discount given</>}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Revenue by Day of Week */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Revenue by Day of Week
            </CardTitle>
            <span className="text-xs text-muted-foreground">All-time, Mon – Sun</span>
          </CardHeader>
          <CardContent>
            {revByDayLoading ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
            ) : (() => {
              const totalRevenue = revenueByDay.reduce((s, d) => s + d.revenue, 0);
              const hasData = totalRevenue > 0;

              if (!hasData) {
                return (
                  <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
                    <CalendarDays className="w-10 h-10 mb-3 opacity-25" />
                    <p className="text-sm">No orders yet — check back once sales come in.</p>
                  </div>
                );
              }

              const maxRevenue = Math.max(...revenueByDay.map((d) => d.revenue), 1);
              const bestDay = revenueByDay.reduce((best, d) => d.revenue > best.revenue ? d : best, revenueByDay[0]);
              const avgRevenue = totalRevenue / revenueByDay.filter((d) => d.revenue > 0).length;

              const DayTooltip = ({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-card border rounded-lg px-3 py-2 shadow-md text-sm">
                    <p className="font-semibold mb-1">{label}</p>
                    <p className="text-primary font-medium">{formatCurrency(d.revenue)}</p>
                    <p className="text-muted-foreground text-xs">{d.orderCount} order{d.orderCount !== 1 ? "s" : ""}</p>
                    <p className="text-muted-foreground text-xs">
                      {totalRevenue > 0 ? ((d.revenue / totalRevenue) * 100).toFixed(1) : "0"}% of total
                    </p>
                  </div>
                );
              };

              return (
                <div className="space-y-4">
                  {/* Insight strip */}
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2 flex flex-wrap gap-x-6 gap-y-1">
                    <span>Best day: <span className="font-semibold text-foreground">{bestDay.day} — {formatCurrency(bestDay.revenue)}</span></span>
                    <span>Avg (active days): <span className="font-semibold text-foreground">{formatCurrency(avgRevenue)}</span></span>
                    <span>Total: <span className="font-semibold text-foreground">{formatCurrency(totalRevenue)}</span></span>
                  </div>

                  {/* Bar chart */}
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={revenueByDay} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barCategoryGap="30%">
                      <defs>
                        <linearGradient id="dayBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => v === 0 ? "$0" : `$${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? "k" : ""}`}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        width={42}
                      />
                      <Tooltip content={<DayTooltip />} cursor={{ fill: "hsl(var(--muted))", radius: 4 }} />
                      <Bar dataKey="revenue" radius={[5, 5, 0, 0]} maxBarSize={52}>
                        {revenueByDay.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.day === bestDay.day ? "url(#dayBarGrad)" : "hsl(var(--primary) / 0.35)"}
                            stroke={entry.day === bestDay.day ? "hsl(var(--primary))" : "transparent"}
                            strokeWidth={entry.day === bestDay.day ? 1 : 0}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Per-day mini summary */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                    {revenueByDay.map((d) => (
                      <div key={d.day} className={`rounded-md py-1.5 px-0.5 ${d.day === bestDay.day ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"}`}>
                        <div className="font-medium">{d.day}</div>
                        <div>{d.orderCount} ord</div>
                        <div
                          className="mt-1 mx-auto rounded-full"
                          style={{
                            width: 24,
                            height: 3,
                            backgroundColor: d.revenue > 0
                              ? `rgba(37,211,102,${0.2 + (d.revenue / maxRevenue) * 0.8})`
                              : "hsl(var(--muted))",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </motion.div>

      </div>
    </AppLayout>
  );
}
