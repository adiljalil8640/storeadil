import { useState } from "react";
import { useParams } from "wouter";
import { useTrackOrder } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Store,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  Package,
  ArrowLeft,
  RefreshCw,
  ShoppingBag,
  MessageCircle,
  Star,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="focus:outline-none"
        >
          <Star
            className={`w-7 h-7 transition-colors ${
              n <= (hovered || value)
                ? "text-amber-400 fill-amber-400"
                : "text-muted-foreground/25 hover:text-amber-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewItem({ item, trackingToken }: { item: any; trackingToken: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "submitted" | "already">("idle");
  const [loading, setLoading] = useState(false);
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleSubmit = async () => {
    if (rating === 0) { toast.error("Please select a star rating"); return; }
    setLoading(true);
    try {
      const r = await fetch(`${basePath}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingToken, productId: item.productId, rating, comment }),
      });
      if (r.status === 409) { setStatus("already"); return; }
      if (!r.ok) { toast.error("Failed to submit review. Please try again."); return; }
      setStatus("submitted");
      toast.success("Review submitted — thank you!");
    } catch { toast.error("Failed to submit review. Please try again."); }
    finally { setLoading(false); }
  };

  if (status === "submitted") {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={`w-4 h-4 ${n <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`} />
          ))}
        </div>
        <div>
          <p className="text-sm font-medium">{item.productName}</p>
          <p className="text-xs text-green-600 font-medium">Thank you for your review!</p>
        </div>
      </div>
    );
  }

  if (status === "already") {
    return (
      <div className="py-2">
        <p className="text-sm font-medium">{item.productName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Already reviewed</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-5 border-b last:border-0 last:pb-0">
      <p className="text-sm font-semibold">{item.productName}</p>
      <StarPicker value={rating} onChange={setRating} />
      <Textarea
        placeholder="Share your experience (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="text-sm resize-none h-20"
        maxLength={500}
      />
      <Button
        size="sm"
        className="gap-2"
        onClick={handleSubmit}
        disabled={loading || rating === 0}
      >
        {loading
          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          : <Star className="w-3.5 h-3.5" />}
        Submit Review
      </Button>
    </div>
  );
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string; description: string }> = {
  pending: {
    label: "Order Received",
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 border-yellow-200",
    description: "Your order has been received and is awaiting confirmation from the store.",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    description: "Great news! The store has confirmed your order and it's being prepared.",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
    description: "Your order is complete. Thank you for your purchase!",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "text-red-500",
    bgColor: "bg-red-50 border-red-200",
    description: "This order has been cancelled. Please contact the store for more information.",
  },
};

const STATUS_STEPS = ["pending", "confirmed", "completed"];

function StatusTimeline({ status }: { status: string }) {
  const currentIndex = STATUS_STEPS.indexOf(status);
  const isCancelled = status === "cancelled";

  return (
    <div className="flex items-center justify-between relative mt-2">
      <div className="absolute left-0 right-0 top-5 h-0.5 bg-muted mx-8" />
      {STATUS_STEPS.map((step, idx) => {
        const cfg = STATUS_CONFIG[step];
        const Icon = cfg.icon;
        const done = !isCancelled && idx <= currentIndex;
        const active = !isCancelled && idx === currentIndex;
        return (
          <div key={step} className="flex flex-col items-center gap-2 z-10 flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                done
                  ? active
                    ? "bg-primary border-primary text-primary-foreground shadow-md"
                    : "bg-primary/80 border-primary/80 text-primary-foreground"
                  : "bg-background border-muted text-muted-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <span className={`text-xs font-medium text-center ${done ? "text-foreground" : "text-muted-foreground"}`}>
              {cfg.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data, isLoading, error, refetch, isFetching } = useTrackOrder(token ?? "", {
    query: {
      enabled: !!token,
      refetchInterval: 30000,
      retry: false,
    },
  });

  const statusCfg = data ? (STATUS_CONFIG[data.status] ?? STATUS_CONFIG.pending) : null;
  const StatusIcon = statusCfg?.icon ?? Clock;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: data?.currency ?? "USD" }).format(amount);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading your order…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">Order Not Found</h1>
          <p className="text-muted-foreground text-sm">
            We couldn't find an order with this tracking link. It may have expired or the link is incorrect.
          </p>
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
              <Store className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">{data.storeName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Status Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className={`border-2 ${statusCfg?.bgColor ?? ""}`}>
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${statusCfg?.bgColor ?? "bg-muted"}`}>
                  <StatusIcon className={`w-7 h-7 ${statusCfg?.color ?? "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Order #{data.orderId}</p>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{statusCfg?.label}</h2>
                    <Badge variant="outline" className={statusCfg?.color}>
                      {data.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Placed {format(new Date(data.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{statusCfg?.description}</p>
              <p className="text-xs text-muted-foreground mt-3 opacity-60">This page refreshes automatically every 30 seconds.</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Timeline */}
        {data.status !== "cancelled" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Order Progress</CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <StatusTimeline status={data.status} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Order Details */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="w-4 h-4 text-primary" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {(data.items as any[]).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between py-2.5 border-b last:border-0 text-sm">
                  <div>
                    <span className="font-medium">{item.productName}</span>
                    {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {Object.entries(item.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(", ")}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">x{item.quantity}</div>
                  </div>
                  <span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(data.total)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Customer & Delivery Info */}
        {(data.customerName || data.deliveryType) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {data.deliveryType === "delivery" ? <Truck className="w-4 h-4 text-primary" /> : <Store className="w-4 h-4 text-primary" />}
                  {data.deliveryType === "delivery" ? "Delivery Details" : "Pickup Order"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.customerName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{data.customerName}</span>
                  </div>
                )}
                {data.deliveryType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <Badge variant="outline" className="capitalize text-xs">{data.deliveryType}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Rate Your Order — only for completed orders with reviewable products */}
        {data.status === "completed" && (data.items as any[]).some((i: any) => i.productId) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  Rate Your Order
                </CardTitle>
                <p className="text-sm text-muted-foreground">How did we do? Your feedback helps other customers.</p>
              </CardHeader>
              <CardContent className="space-y-5">
                {(data.items as any[])
                  .filter((item: any) => item.productId)
                  .map((item: any) => (
                    <ReviewItem key={item.productId} item={item} trackingToken={token ?? ""} />
                  ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="space-y-3">
          <Button
            className="w-full gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white"
            onClick={() => window.open(`${basePath}/store/${data.storeSlug}`, "_blank")}
          >
            <ShoppingBag className="w-4 h-4" />
            Shop Again at {data.storeName}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Questions? Contact the store directly on WhatsApp.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
