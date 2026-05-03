import { useState } from "react";
import { useListOrders, useUpdateOrderStatus, getListOrdersQueryKey, useListWaitlistEntries, useNotifyWaitlist, getListWaitlistEntriesQueryKey, getGetWaitlistCountsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontal, ExternalLink, Package, Bell, Mail, Send } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function WaitlistTab() {
  const queryClient = useQueryClient();
  const { data: entries = [], isLoading } = useListWaitlistEntries();

  const notify = useNotifyWaitlist({
    mutation: {
      onSuccess: (data, vars) => {
        queryClient.invalidateQueries({ queryKey: getListWaitlistEntriesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWaitlistCountsQueryKey() });
        toast.success(`Notified ${data.notified} customer${data.notified === 1 ? "" : "s"}`);
      },
      onError: () => toast.error("Failed to send notifications"),
    },
  });

  // Group entries by product
  const byProduct = entries.reduce<Record<number, typeof entries>>((acc, e) => {
    if (!acc[e.productId]) acc[e.productId] = [];
    acc[e.productId].push(e);
    return acc;
  }, {});

  const products = Object.entries(byProduct).map(([id, list]) => ({
    productId: Number(id),
    productName: list[0].productName,
    entries: list,
  }));

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading waitlist...</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-20">
        <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">No one on the waitlist</h3>
        <p className="text-muted-foreground">When customers sign up to be notified for out-of-stock products, they'll appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {products.map(({ productId, productName, entries: productEntries }) => (
        <Card key={productId}>
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{productName}</h3>
                <p className="text-xs text-muted-foreground">
                  {productEntries.length} customer{productEntries.length === 1 ? "" : "s"} waiting
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              disabled={notify.isPending}
              onClick={() => notify.mutate({ id: productId })}
            >
              <Send className="w-3.5 h-3.5" />
              Notify All ({productEntries.length})
            </Button>
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Signed Up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <span className="font-medium">{entry.name || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`mailto:${entry.email}`}
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        {entry.email}
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <span title={format(new Date(entry.createdAt), "MMM d, yyyy h:mm a")}>
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useListOrders({
    status: statusFilter !== "all" ? statusFilter as any : undefined,
  });

  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast.success("Order status updated");
      }
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-primary/10 text-primary border-primary/20';
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'confirmed': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleUpdateStatus = (id: number, status: any) => {
    updateStatus.mutate({ id, data: { status } });
  };

  const generateWhatsAppLink = (phone: string, orderId: number) => {
    if (!phone) return null;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(`Hi! Regarding your order #${orderId} from our store...`);
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">Manage and process customer orders.</p>
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders" className="gap-2">
              <Package className="w-4 h-4" /> Orders
            </TabsTrigger>
            <TabsTrigger value="waitlist" className="gap-2">
              <Bell className="w-4 h-4" /> Waitlist
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-6">
            <div className="flex justify-end mb-4">
              <div className="w-[180px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Orders</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
                ) : orders?.length === 0 ? (
                  <div className="text-center py-20">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-1">No orders found</h3>
                    <p className="text-muted-foreground">When customers place orders via WhatsApp, they'll appear here.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders?.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">#{order.id}</TableCell>
                          <TableCell>{format(new Date(order.createdAt), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <div>
                              <p>{order.customerName || "Guest"}</p>
                              {order.customerPhone && (
                                <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}>
                            {order.items.reduce((acc, curr) => acc + curr.quantity, 0)} items
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(order.total)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(order.status)}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem className="font-medium">Change Status</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'pending')} disabled={order.status === 'pending'}>
                                  Pending
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'confirmed')} disabled={order.status === 'confirmed'}>
                                  Confirmed
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'completed')} disabled={order.status === 'completed'}>
                                  Completed
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'cancelled')} disabled={order.status === 'cancelled'} className="text-destructive focus:text-destructive">
                                  Cancelled
                                </DropdownMenuItem>

                                {order.customerPhone && (
                                  <>
                                    <div className="h-px bg-border my-1" />
                                    <DropdownMenuItem onClick={() => {
                                      const url = generateWhatsAppLink(order.customerPhone!, order.id);
                                      if (url) window.open(url, '_blank');
                                    }}>
                                      <ExternalLink className="w-4 h-4 mr-2" /> Message Customer
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="waitlist" className="mt-6">
            <WaitlistTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
