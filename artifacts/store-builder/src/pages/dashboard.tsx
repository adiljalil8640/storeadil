import { useState } from "react";
import { useGetAnalyticsSummary, useGetRecentOrders, useGetTopProducts, useListMerchantReviews, useListCoupons, useListProducts, useGetTopCustomers, useGetMyStore, useUpdateRevenueGoal, getGetMyStoreQueryKey, useGetAnalyticsRevenueTrend, useGetWhatsappMessages } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingBag, ShoppingCart, Clock, Star, Tag, Users, Target, Pencil, Check, X, MessageCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";
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
  const { data: revenueTrend = [] } = useGetAnalyticsRevenueTrend();
  const { data: waMessages = [] } = useGetWhatsappMessages({ limit: 5 }, { query: { enabled: !!store } });
  const queryClient = useQueryClient();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const updateGoal = useUpdateRevenueGoal({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetMyStoreQueryKey() }); setEditingGoal(false); } } });
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  const chartData = [ { name: 'Completed', value: analytics?.completedOrders || 0, color: 'hsl(var(--primary))' }, { name: 'Pending', value: analytics?.pendingOrders || 0, color: 'hsl(var(--chart-3))' } ];
  const totalReviews = reviews.length;
  const avgRating = totalReviews ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / totalReviews : null;
  return <AppLayout><div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">Dashboard</h1><p className="text-muted-foreground">Overview of your store's performance.</p></div><motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[#25D366]" />WhatsApp Messages</CardTitle></CardHeader><CardContent>{waMessages.length === 0 ? <p className="text-sm text-muted-foreground">No WhatsApp conversations yet.</p> : <div className="space-y-3">{waMessages.map((m: any) => <div key={m.id} className="rounded-lg border p-3 text-sm"><div className="flex items-center justify-between text-xs text-muted-foreground mb-2"><span>{m.customerPhone}</span><span>{format(new Date(m.createdAt), 'PP p')}</span></div><p className="font-medium">Customer: {m.customerMessage}</p><p className="text-muted-foreground mt-1">Reply: {m.aiReply}</p></div>)}</div>}</CardContent></Card></motion.div></div></AppLayout>;
}
