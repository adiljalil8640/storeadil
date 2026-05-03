import { useState } from "react";
import {
  useListWaitlistEntries,
  useNotifyWaitlist,
  useGetWaitlistCounts,
  getListWaitlistEntriesQueryKey,
  getGetWaitlistCountsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bell, BellOff, Users, Send, CheckCircle, Clock, Mail } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

type WaitlistEntry = {
  id: number;
  productId: number;
  productName: string;
  email: string;
  name: string | null;
  createdAt: string;
};

type ProductGroup = {
  productId: number;
  productName: string;
  entries: WaitlistEntry[];
};

function groupByProduct(entries: WaitlistEntry[]): ProductGroup[] {
  const map = new Map<number, ProductGroup>();
  for (const entry of entries) {
    if (!map.has(entry.productId)) {
      map.set(entry.productId, { productId: entry.productId, productName: entry.productName, entries: [] });
    }
    map.get(entry.productId)!.entries.push(entry);
  }
  return Array.from(map.values()).sort((a, b) => b.entries.length - a.entries.length);
}

function ProductWaitlistCard({ group, onNotified }: { group: ProductGroup; onNotified: () => void }) {
  const [notifiedIds, setNotifiedIds] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState(true);

  const notify = useNotifyWaitlist({
    mutation: {
      onSuccess: (data) => {
        toast.success(`Notified ${data.notified} customer${data.notified === 1 ? "" : "s"} about "${group.productName}"`);
        setNotifiedIds(new Set(group.entries.map((e) => e.id)));
        setTimeout(onNotified, 800);
      },
      onError: () => toast.error("Failed to send notifications"),
    },
  });

  const pending = group.entries.filter((e) => !notifiedIds.has(e.id));
  const allNotified = pending.length === 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
    >
      <Card className={allNotified ? "opacity-60" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                {allNotified
                  ? <CheckCircle className="w-4 h-4 text-primary" />
                  : <Bell className="w-4 h-4 text-amber-600" />
                }
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base truncate">{group.productName}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {allNotified ? "All customers notified" : `${pending.length} customer${pending.length === 1 ? "" : "s"} waiting`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Hide" : "Show"} list
              </Button>
              {!allNotified && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={notify.isPending}
                  onClick={() => notify.mutate({ id: group.productId })}
                >
                  <Send className="w-3.5 h-3.5" />
                  {notify.isPending ? "Sending…" : "Notify All"}
                </Button>
              )}
              {allNotified && (
                <Badge variant="outline" className="gap-1 text-primary border-primary/30">
                  <CheckCircle className="w-3 h-3" /> Done
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0 pb-3">
                <div className="divide-y rounded-lg border overflow-hidden">
                  {group.entries.map((entry) => {
                    const wasJustNotified = notifiedIds.has(entry.id);
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${wasJustNotified ? "bg-primary/5" : "bg-background"}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.name || entry.email}</p>
                          {entry.name && (
                            <p className="text-xs text-muted-foreground truncate">{entry.email}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Joined {new Date(entry.createdAt).toLocaleDateString("en-US", {
                                year: "numeric", month: "long", day: "numeric",
                              })}
                            </TooltipContent>
                          </Tooltip>
                          {wasJustNotified && (
                            <Badge variant="outline" className="text-primary border-primary/30 gap-1 text-xs py-0">
                              <CheckCircle className="w-2.5 h-2.5" /> Sent
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default function WaitlistPage() {
  const queryClient = useQueryClient();
  const { data: entries = [], isLoading } = useListWaitlistEntries();
  const { data: countsData } = useGetWaitlistCounts();

  const totalWaiting = Object.values(countsData?.counts ?? {}).reduce((s, c) => s + c, 0);
  const groups = groupByProduct(entries as WaitlistEntry[]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListWaitlistEntriesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetWaitlistCountsQueryKey() });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Waitlist</h1>
            <p className="text-muted-foreground">
              Customers waiting to be notified when out-of-stock products are restocked.
            </p>
          </div>
          {totalWaiting > 0 && (
            <Badge className="gap-1.5 text-sm px-3 py-1.5 bg-amber-500 hover:bg-amber-500 text-white self-start sm:self-auto">
              <Bell className="w-3.5 h-3.5" />
              {totalWaiting} waiting
            </Badge>
          )}
        </div>

        {/* Auto-notification notice */}
        <div className="flex items-start gap-3 rounded-xl border bg-primary/5 border-primary/20 px-4 py-3">
          <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground/80">
            <span className="font-semibold text-primary">Auto-notifications are active.</span>{" "}
            When you update a product's stock from 0 to any positive number, all waitlisted customers are automatically emailed. You can also notify them manually below.
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading waitlist…</div>
        ) : groups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 border border-dashed rounded-xl bg-card"
          >
            <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <BellOff className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium mb-1">No pending waitlist entries</h3>
            <p className="text-muted-foreground max-w-sm mx-auto text-sm">
              When customers sign up to be notified about out-of-stock products, they'll appear here.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                      <Users className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalWaiting}</p>
                      <p className="text-xs text-muted-foreground">Total waiting</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{groups.length}</p>
                      <p className="text-xs text-muted-foreground">Products with waitlist</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Per-product cards */}
            <AnimatePresence mode="popLayout">
              {groups.map((group) => (
                <ProductWaitlistCard key={group.productId} group={group} onNotified={invalidateAll} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
