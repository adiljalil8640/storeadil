import { useState } from "react";
import { useGetAnalyticsSummary, useGetOrdersPerDay, useGetTopProducts } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, ShoppingCart, Package, TrendingUp, Download } from "lucide-react";
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
      </div>
    </AppLayout>
  );
}
