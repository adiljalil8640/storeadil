import { useState } from "react";
import { useGetAdminStats, useGetAdminUsers, useChangeUserPlan, getGetAdminUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Store, ShoppingCart, DollarSign, Shield, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-secondary text-secondary-foreground",
  pro: "bg-primary/10 text-primary",
  business: "bg-violet-100 text-violet-700",
};

export default function AdminPage() {
  const qc = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: users, isLoading: usersLoading } = useGetAdminUsers({ limit: 100 });

  const changePlan = useChangeUserPlan({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
        toast.success("Plan updated successfully");
      },
      onError: () => toast.error("Failed to update plan"),
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
            <p className="text-muted-foreground text-sm">Platform overview and user management.</p>
          </div>
        </div>

        {/* Stats */}
        {!statsLoading && stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-600" },
              { label: "Total Stores", value: stats.totalStores, icon: Store, color: "text-primary" },
              { label: "Total Orders", value: stats.totalOrders, icon: ShoppingCart, color: "text-yellow-600" },
              { label: "Total Revenue", value: `$${Number(stats.totalRevenue).toFixed(0)}`, icon: DollarSign, color: "text-green-600" },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpi.value}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Plan Breakdown */}
        {stats?.planBreakdown && (
          <Card>
            <CardHeader><CardTitle>Plan Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-6 flex-wrap">
                {Object.entries(stats.planBreakdown).map(([plan, count]) => (
                  <div key={plan} className="flex items-center gap-2">
                    <Badge className={PLAN_COLORS[plan] ?? ""}>{plan}</Badge>
                    <span className="font-semibold">{count}</span>
                    <span className="text-muted-foreground text-sm">users</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 animate-pulse bg-muted rounded" />)}
              </div>
            ) : !users?.length ? (
              <div className="text-center py-8 text-muted-foreground">No users yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 pr-4 font-medium">User ID</th>
                      <th className="text-left py-2 pr-4 font-medium">Store</th>
                      <th className="text-left py-2 pr-4 font-medium">Plan</th>
                      <th className="text-right py-2 pr-4 font-medium">Orders (month)</th>
                      <th className="text-right py-2 pr-4 font-medium">Total Orders</th>
                      <th className="text-left py-2 font-medium">Change Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, idx) => (
                      <motion.tr
                        key={user.userId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        className="border-b last:border-0"
                      >
                        <td className="py-3 pr-4">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{user.userId.slice(0, 16)}…</code>
                        </td>
                        <td className="py-3 pr-4">
                          {user.storeSlug ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{user.storeName ?? user.storeSlug}</span>
                              <a href={`/store/${user.storeSlug}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={`text-xs ${PLAN_COLORS[user.planName] ?? ""}`}>
                            {user.planDisplayName}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right">{user.ordersThisMonth}</td>
                        <td className="py-3 pr-4 text-right">{user.totalOrders}</td>
                        <td className="py-3">
                          <Select
                            defaultValue={user.planName}
                            onValueChange={(val) =>
                              changePlan.mutate({ userId: user.userId, data: { planName: val as "free" | "pro" | "business" } })
                            }
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                              <SelectItem value="business">Business</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
