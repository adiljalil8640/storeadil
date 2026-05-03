import { useGetAnalyticsSummary, useGetRecentOrders, useGetTopProducts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingBag, ShoppingCart, Activity, Package, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: analytics, isLoading: analyticsLoading } = useGetAnalyticsSummary();
  const { data: recentOrders, isLoading: ordersLoading } = useGetRecentOrders({ limit: 5 });
  const { data: topProducts, isLoading: productsLoading } = useGetTopProducts({ limit: 5 });

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
        </div>

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