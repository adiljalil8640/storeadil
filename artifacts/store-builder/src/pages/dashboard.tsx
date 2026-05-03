import { useState } from "react";
import { useGetAnalyticsSummary, useGetRecentOrders, useGetTopProducts, useListMerchantReviews, useListCoupons, useListProducts, useGetTopCustomers, useGetMyStore, useUpdateRevenueGoal, getGetMyStoreQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingBag, ShoppingCart, Activity, Package, Clock, Star, Tag, AlertTriangle, Users, Target, Pencil, Check, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: analytics, isLoading: analyticsLoading } = useGetAnalyticsSummary();
  const { data: recentOrders, isLoading: ordersLoading } = useGetRecentOrders({ limit: 5 });
  const { data: topProducts, isLoading: productsLoading } = useGetTopProducts({ limit: 5 });
  const { data: reviews = [], isLoading: reviewsLoading } = useListMerchantReviews();
  const { data: coupons = [], isLoading: couponsLoading } = useListCoupons();
  const { data: allProducts = [], isLoading: stockLoading } = useListProducts();
  const { data: topCustomers = [], isLoading: customersLoading } = useGetTopCustomers({ limit: 8 });
  const { data: store } = useGetMyStore();
  const queryClient = useQueryClient();

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  const updateGoal = useUpdateRevenueGoal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyStoreQueryKey() });
        setEditingGoal(false);
      },
    },
  });

  const DEFAULT_LOW_STOCK = 5;
  const outOfStock = allProducts.filter(
    (p) => p.isActive && p.stock !== null && p.stock !== undefined && p.stock === 0
  );
  const lowStock = allProducts.filter((p) => {
    if (!p.isActive || p.stock === null || p.stock === undefined || p.stock === 0) return false;
    const threshold = p.lowStockThreshold ?? DEFAULT_LOW_STOCK;
    return p.stock <= threshold;
  });
  const stockAlerts = [
    ...outOfStock.map((p) => ({ ...p, alertType: "out" as const })),
    ...lowStock.map((p) => ({ ...p, alertType: "low" as const })),
  ].sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));

  const totalReviews = reviews.length;
  const avgRating = totalReviews
    ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / totalReviews
    : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const chartData = [
    { name: 'Completed', value: analytics?.completedOrders || 0, color: 'hsl(var(--primary))' },
    { name: 'Pending', value: analytics?.pendingOrders || 0, color: 'hsl(var(--chart-3))' }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your store's performance.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsLoading ? "..." : formatCurrency(analytics?.totalRevenue || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analyticsLoading ? "..." : formatCurrency(analytics?.revenueThisMonth || 0)} this month
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsLoading ? "..." : analytics?.totalOrders || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analyticsLoading ? "..." : analytics?.ordersThisMonth || 0} this month
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsLoading ? "..." : analytics?.pendingOrders || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Needs your attention
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsLoading ? "..." : analytics?.activeProducts || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Out of {analyticsLoading ? "..." : analytics?.totalProducts || 0} total
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Link href="/reviews">
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {reviewsLoading ? (
                    <div className="text-2xl font-bold">...</div>
                  ) : avgRating === null ? (
                    <>
                      <div className="text-2xl font-bold text-muted-foreground">—</div>
                      <p className="text-xs text-muted-foreground">No reviews yet</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <div className="text-2xl font-bold">{avgRating.toFixed(1)}</div>
                        <div className="flex gap-px mb-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className={`w-3 h-3 ${n <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {totalReviews} review{totalReviews !== 1 ? "s" : ""} · View all →
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        </div>

        {/* Revenue Goal Tracker */}
        {(() => {
          const goal = store?.monthlyRevenueGoal != null ? Number(store.monthlyRevenueGoal) : null;
          const earned = analytics?.revenueThisMonth ?? 0;
          const pct = goal && goal > 0 ? Math.min((earned / goal) * 100, 100) : 0;
          const now = new Date();
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const daysLeft = daysInMonth - now.getDate();
          const onTrack = goal && daysLeft > 0
            ? (earned / (now.getDate() / daysInMonth)) >= goal * 0.9
            : null;

          const saveGoal = () => {
            const val = parseFloat(goalInput.replace(/[^0-9.]/g, ""));
            if (!isNaN(val) && val >= 0) updateGoal.mutate({ data: { goal: val } });
          };

          return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Monthly Revenue Goal</CardTitle>
                  </div>
                  {!editingGoal ? (
                    <button
                      onClick={() => { setGoalInput(goal != null ? String(goal) : ""); setEditingGoal(true); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                      {goal == null ? "Set goal" : "Edit"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        value={goalInput}
                        onChange={(e) => setGoalInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(false); }}
                        placeholder="e.g. 5000"
                        className="w-28 text-xs border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button onClick={saveGoal} className="p-1 text-primary hover:text-primary/80" title="Save">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingGoal(false)} className="p-1 text-muted-foreground hover:text-foreground" title="Cancel">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {goal == null ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">No goal set yet.</p>
                      <button
                        onClick={() => { setGoalInput(""); setEditingGoal(true); }}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Set a monthly revenue goal →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Numbers row */}
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-2xl font-bold">{formatCurrency(earned)}</span>
                          <span className="text-sm text-muted-foreground ml-1">/ {formatCurrency(goal)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-semibold text-primary">{pct.toFixed(0)}%</span>
                          <p className="text-xs text-muted-foreground">{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? "bg-primary" : pct >= 70 ? "bg-primary/80" : pct >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Status line */}
                      <p className="text-xs text-muted-foreground">
                        {pct >= 100 ? (
                          <span className="text-primary font-semibold">Goal reached! 🎉 You've hit your target for this month.</span>
                        ) : onTrack === true ? (
                          <span className="text-primary">On track — keep it up!</span>
                        ) : onTrack === false ? (
                          <span className="text-amber-600 dark:text-amber-400">Behind pace — {formatCurrency(goal - earned)} to go.</span>
                        ) : (
                          <span>{formatCurrency(goal - earned)} remaining this month.</span>
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })()}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Order Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              {analyticsLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {productsLoading ? (
                  <div className="text-center text-muted-foreground py-4">Loading top products...</div>
                ) : topProducts?.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">No sales data yet</div>
                ) : (
                  topProducts?.map((product) => (
                    <div key={product.id} className="flex items-center">
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mr-4 overflow-hidden">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.orderCount} orders</p>
                      </div>
                      <div className="font-medium">{formatCurrency(product.totalRevenue)}</div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                Coupon Performance
              </CardTitle>
              <Link href="/coupons" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Manage →
              </Link>
            </CardHeader>
            <CardContent>
              {couponsLoading ? (
                <div className="text-center text-muted-foreground py-6">Loading...</div>
              ) : coupons.length === 0 ? (
                <div className="text-center text-muted-foreground py-6 space-y-1">
                  <p className="text-sm">No coupons created yet.</p>
                  <Link href="/coupons" className="text-xs text-primary hover:underline">Create your first coupon →</Link>
                </div>
              ) : (() => {
                const sorted = [...coupons].sort((a, b) => (b.usedCount ?? 0) - (a.usedCount ?? 0));
                const top = sorted.slice(0, 5);
                const maxUses = top[0]?.usedCount ?? 1;
                const totalRedemptions = coupons.reduce((s, c) => s + (c.usedCount ?? 0), 0);
                const activeCoupons = coupons.filter(c => c.isActive).length;
                return (
                  <div className="space-y-4">
                    {/* Summary row */}
                    <div className="flex items-center gap-6 pb-3 border-b">
                      <div>
                        <p className="text-2xl font-bold">{totalRedemptions}</p>
                        <p className="text-xs text-muted-foreground">total redemptions</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{activeCoupons}</p>
                        <p className="text-xs text-muted-foreground">active coupons</p>
                      </div>
                    </div>

                    {/* Per-coupon rows */}
                    {totalRedemptions === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">No redemptions yet — share your coupon codes!</p>
                    ) : (
                      <div className="space-y-3">
                        {top.filter(c => (c.usedCount ?? 0) > 0).map(coupon => {
                          const uses = coupon.usedCount ?? 0;
                          const pct = maxUses > 0 ? (uses / maxUses) * 100 : 0;
                          const discountLabel = coupon.type === "percentage"
                            ? `${Number(coupon.value).toFixed(0)}% off`
                            : `${formatCurrency(Number(coupon.value))} off`;
                          return (
                            <div key={coupon.id} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono font-semibold text-sm tracking-wide truncate">{coupon.code}</span>
                                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                                    coupon.type === "percentage"
                                      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                  }`}>
                                    {discountLabel}
                                  </span>
                                  {!coupon.isActive && (
                                    <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inactive</span>
                                  )}
                                </div>
                                <span className="shrink-0 text-sm font-semibold tabular-nums">
                                  {uses} use{uses !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Stock Alerts
                {!stockLoading && stockAlerts.length > 0 && (
                  <span className="ml-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                    {stockAlerts.length}
                  </span>
                )}
              </CardTitle>
              <Link href="/products" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Manage →
              </Link>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="text-center text-muted-foreground py-6">Loading...</div>
              ) : allProducts.every((p) => p.stock === null || p.stock === undefined) ? (
                <div className="text-center text-muted-foreground py-6 space-y-1">
                  <p className="text-sm">Stock tracking is not enabled.</p>
                  <Link href="/products" className="text-xs text-primary hover:underline">
                    Set stock levels on your products →
                  </Link>
                </div>
              ) : stockAlerts.length === 0 ? (
                <div className="flex items-center gap-3 py-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">All products are well-stocked</p>
                    <p className="text-xs text-muted-foreground">No low-stock or out-of-stock items right now</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-0">
                  {/* Summary badges */}
                  <div className="flex items-center gap-2 pb-3 mb-1">
                    {outOfStock.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-destructive/10 text-destructive">
                        {outOfStock.length} out of stock
                      </span>
                    )}
                    {lowStock.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {lowStock.length} running low
                      </span>
                    )}
                  </div>

                  {/* Alert rows */}
                  {stockAlerts.slice(0, 6).map((product) => {
                    const isOut = product.alertType === "out";
                    const threshold = product.lowStockThreshold ?? DEFAULT_LOW_STOCK;
                    const pct = isOut ? 0 : Math.min(100, Math.round(((product.stock ?? 0) / threshold) * 100));
                    return (
                      <div key={product.id} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                        {/* Product image / placeholder */}
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>

                        {/* Name + mini stock bar */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isOut ? "w-0" : "bg-amber-400"}`}
                                style={isOut ? undefined : { width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Stock count + badge */}
                        <div className="shrink-0 text-right">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isOut
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}>
                            {isOut ? "Out of stock" : `${product.stock} left`}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {stockAlerts.length > 6 && (
                    <p className="text-xs text-muted-foreground text-center pt-3">
                      +{stockAlerts.length - 6} more —{" "}
                      <Link href="/products" className="text-primary hover:underline">view all products</Link>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Customers */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Top Customers</CardTitle>
              </div>
              <Link href="/orders" className="text-xs text-primary hover:underline">View orders →</Link>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <div className="text-center text-muted-foreground py-6 text-sm">Loading...</div>
              ) : topCustomers.length === 0 ? (
                <div className="text-center text-muted-foreground py-6 text-sm">No orders yet</div>
              ) : (() => {
                const maxSpend = topCustomers[0]?.totalSpend ?? 1;
                const formatCurrency = (n: number) =>
                  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
                const initials = (c: typeof topCustomers[0]) => {
                  const name = c.name ?? c.email ?? c.phone ?? "G";
                  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
                };
                const displayName = (c: typeof topCustomers[0]) =>
                  c.name ?? c.email ?? c.phone ?? "Guest";

                return (
                  <div className="space-y-3">
                    {topCustomers.map((customer, idx) => {
                      const pct = maxSpend > 0 ? (customer.totalSpend / maxSpend) * 100 : 0;
                      return (
                        <div key={customer.key} className="flex items-center gap-3">
                          {/* Rank + avatar */}
                          <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{idx + 1}</span>
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 select-none">
                            {initials(customer)}
                          </div>

                          {/* Name + bar */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium truncate" title={displayName(customer)}>
                                {displayName(customer)}
                              </span>
                              <span className="text-sm font-semibold text-primary ml-2 shrink-0">
                                {formatCurrency(customer.totalSpend)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {customer.orderCount} {customer.orderCount === 1 ? "order" : "orders"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="text-center text-muted-foreground py-8">Loading recent orders...</div>
            ) : recentOrders?.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No orders yet</div>
            ) : (
              <div className="space-y-8">
                {recentOrders?.map((order) => (
                  <div key={order.id} className="flex items-center">
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">
                        Order #{order.id} • {order.customerName || "Guest"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold
                        ${order.status === 'completed' ? 'bg-primary/10 text-primary' : ''}
                        ${order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' : ''}
                        ${order.status === 'confirmed' ? 'bg-blue-500/10 text-blue-600' : ''}
                        ${order.status === 'cancelled' ? 'bg-destructive/10 text-destructive' : ''}
                      `}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </div>
                      <div className="font-medium w-20 text-right">{formatCurrency(order.total)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}