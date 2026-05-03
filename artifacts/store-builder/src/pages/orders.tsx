import React, { useState } from "react";
import { useListOrders, useUpdateOrderStatus, useBulkUpdateOrderStatus, useUpdateOrderNote, getListOrdersQueryKey, useListWaitlistEntries, useNotifyWaitlist, getListWaitlistEntriesQueryKey, getGetWaitlistCountsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontal, ExternalLink, Package, Bell, Mail, Send, Search, X, ArrowUpDown, CheckSquare, Download, StickyNote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("completed");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const queryClient = useQueryClient();

  const { data: rawOrders, isLoading } = useListOrders({
    status: statusFilter !== "all" ? statusFilter as any : undefined,
  });

  const orders = (() => {
    let list = rawOrders ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((o) =>
        String(o.id).includes(q) ||
        (o.customerName ?? "").toLowerCase().includes(q) ||
        (o.customerPhone ?? "").toLowerCase().includes(q) ||
        (o.customerEmail ?? "").toLowerCase().includes(q) ||
        o.items.some((i) => i.productName.toLowerCase().includes(q))
      );
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "highest") return Number(b.total) - Number(a.total);
      if (sortBy === "lowest") return Number(a.total) - Number(b.total);
      return 0;
    });
    return list;
  })();

  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast.success("Order status updated");
      }
    }
  });

  const updateNote = useUpdateOrderNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        setEditingNoteId(null);
        toast.success("Note saved");
      },
      onError: () => toast.error("Failed to save note"),
    },
  });

  const openNoteEditor = (order: any) => {
    setNoteText(order.ownerNote ?? "");
    setEditingNoteId(order.id);
  };

  const saveNote = (orderId: number) => {
    updateNote.mutate({ id: orderId, data: { ownerNote: noteText.trim() || null } });
  };

  const bulkUpdate = useBulkUpdateOrderStatus({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        setSelectedIds(new Set());
        toast.success(`${data.updated} order${data.updated !== 1 ? "s" : ""} updated to ${bulkStatus}`);
      },
      onError: () => toast.error("Bulk update failed"),
    },
  });

  const allVisibleIds = orders.map((o) => o.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someSelected = allVisibleIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applyBulk = () => {
    if (selectedIds.size === 0) return;
    bulkUpdate.mutate({ data: { orderIds: Array.from(selectedIds), status: bulkStatus } });
  };

  const downloadCsv = () => {
    const escape = (v: string | null | undefined) => {
      const s = v ?? "";
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: string[] = [
      ["Order #", "Date", "Customer", "Phone", "Email", "Items", "Total", "Status", "Delivery", "Note"].join(","),
      ...orders.map((o) => [
        o.id,
        format(new Date(o.createdAt), "yyyy-MM-dd HH:mm"),
        escape(o.customerName),
        escape(o.customerPhone),
        escape(o.customerEmail),
        escape(o.items.map((i: any) => `${i.productName ?? i.productId} x${i.quantity}`).join("; ")),
        Number(o.total).toFixed(2),
        o.status,
        escape(o.deliveryType),
        escape(o.customerNote),
      ].join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const label = search || statusFilter !== "all" ? `orders-filtered` : `orders-all`;
    a.href = url;
    a.download = `${label}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by customer, phone, email, product, or order #…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-8"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status filter */}
              <div className="w-full sm:w-[160px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort */}
              <div className="w-full sm:w-[160px]">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger>
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                    <SelectItem value="highest">Highest total</SelectItem>
                    <SelectItem value="lowest">Lowest total</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Export */}
              <Button
                variant="outline"
                size="sm"
                onClick={downloadCsv}
                disabled={orders.length === 0}
                className="shrink-0 h-10 gap-2"
                title="Download visible orders as CSV"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
            </div>

            {/* Result count */}
            {(search || statusFilter !== "all") && !isLoading && (
              <p className="text-xs text-muted-foreground mb-3">
                {orders.length === 0
                  ? "No orders match your filters."
                  : `${orders.length} order${orders.length !== 1 ? "s" : ""} found`}
                {search && (
                  <button onClick={() => setSearch("")} className="ml-2 text-primary hover:underline">
                    Clear search
                  </button>
                )}
              </p>
            )}

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
                        <TableHead className="w-10 pl-4">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleAll}
                            aria-label="Select all"
                            data-state={someSelected && !allSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                          />
                        </TableHead>
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
                        <React.Fragment key={order.id}>
                        <TableRow
                          data-selected={selectedIds.has(order.id)}
                          className={selectedIds.has(order.id) ? "bg-primary/5" : ""}
                        >
                          <TableCell className="pl-4">
                            <Checkbox
                              checked={selectedIds.has(order.id)}
                              onCheckedChange={() => toggleOne(order.id)}
                              aria-label={`Select order #${order.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-0.5">
                              <span>#{order.id}</span>
                              {order.ownerNote && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground max-w-[120px] truncate" title={order.ownerNote}>
                                  <StickyNote className="h-3 w-3 shrink-0" />
                                  {order.ownerNote}
                                </span>
                              )}
                            </div>
                          </TableCell>
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

                                <div className="h-px bg-border my-1" />
                                <DropdownMenuItem onClick={() => openNoteEditor(order)}>
                                  <StickyNote className="w-4 h-4 mr-2" />
                                  {order.ownerNote ? "Edit note" : "Add note"}
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

                        {/* Inline note editor row */}
                        {editingNoteId === order.id && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={9} className="py-3 px-5">
                              <div className="flex flex-col gap-2 max-w-xl">
                                <p className="text-xs font-medium text-muted-foreground">Internal note for order #{order.id} (not visible to customer)</p>
                                <Textarea
                                  autoFocus
                                  rows={2}
                                  placeholder="e.g. Paid via bank transfer, priority shipping…"
                                  value={noteText}
                                  onChange={(e) => setNoteText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote(order.id);
                                    if (e.key === "Escape") setEditingNoteId(null);
                                  }}
                                  className="resize-none text-sm"
                                />
                                <div className="flex items-center gap-2">
                                  <Button size="sm" className="h-7 text-xs" onClick={() => saveNote(order.id)} disabled={updateNote.isPending}>
                                    {updateNote.isPending ? "Saving…" : "Save note"}
                                  </Button>
                                  {noteText.trim() && (
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => { setNoteText(""); saveNote(order.id); }}>
                                      Clear note
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingNoteId(null)}>
                                    Cancel
                                  </Button>
                                  <span className="text-xs text-muted-foreground ml-auto hidden sm:block">⌘ Enter to save · Esc to cancel</span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        </React.Fragment>
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

      {/* Floating bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 bg-card border shadow-xl rounded-2xl px-5 py-3">
              {/* Count + icon */}
              <div className="flex items-center gap-2 text-sm font-medium pr-2 border-r">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span>{selectedIds.size} selected</span>
              </div>

              {/* Status picker */}
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="h-8 w-[140px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Apply */}
              <Button
                size="sm"
                onClick={applyBulk}
                disabled={bulkUpdate.isPending}
                className="h-8"
              >
                {bulkUpdate.isPending ? "Updating…" : "Apply"}
              </Button>

              {/* Clear */}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
