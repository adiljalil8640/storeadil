import { useState, useMemo, useEffect } from "react";
import { useParams } from "wouter";
import { useGetPublicStore, useCreateOrder, useJoinWaitlist, useValidateCoupon, useGetStoreReviews } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Store, ShoppingCart, Plus, Minus, Send, Info, Package, CheckCircle, ExternalLink, Copy, Bell, Tag, X, Clock, AlertTriangle, Star } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// --- Store hours helpers ---
const STORE_DAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function getStoreOpenStatus(
  hours: Record<string, { enabled: boolean; open: string; close: string }>,
  holidays?: string[] | null
): { open: boolean; label: string } {
  const now = new Date();
  // Check holiday closures first
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (holidays?.includes(todayISO)) return { open: false, label: "Holiday · Closed" };
  const dayKey = STORE_DAYS[now.getDay()];
  const day = hours[dayKey];
  if (!day?.enabled) return { open: false, label: "Closed today" };
  const [oh, om] = day.open.split(":").map(Number);
  const [ch, cm] = day.close.split(":").map(Number);
  const nowM  = now.getHours() * 60 + now.getMinutes();
  const openM = oh * 60 + om;
  const closeM = ch * 60 + cm;
  if (nowM >= openM && nowM < closeM) return { open: true,  label: `Open · Closes ${fmtTime(day.close)}` };
  if (nowM < openM)                   return { open: false, label: `Opens ${fmtTime(day.open)}` };
  return { open: false, label: "Closed" };
}

type CartItem = {
  product: any;
  quantity: number;
};

type OrderConfirmation = {
  orderId: number;
  trackingToken: string;
  whatsappUrl: string;
  storeName: string;
};

function WaitlistButton({ product, slug }: { product: any; slug: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  const join = useJoinWaitlist({
    mutation: {
      onSuccess: () => {
        setDone(true);
        toast.success("You're on the list! We'll email you when it's back.");
      },
      onError: (e: any) => {
        const msg = e?.response?.data?.error ?? "Something went wrong.";
        toast.error(msg);
      },
    },
  });

  if (done) {
    return (
      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
        <CheckCircle className="w-3 h-3" /> On the list
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full h-8 px-3 gap-1.5 text-xs">
          <Bell className="w-3 h-3" /> Notify Me
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Notify me when back</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <strong>{product.name}</strong> is currently out of stock. Enter your email and we'll alert you the moment it's available again.
        </p>
        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs mb-1.5 block">Email <span className="text-destructive">*</span></Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Name <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              placeholder="Jane"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <Button
            className="w-full gap-2"
            disabled={!email || join.isPending}
            onClick={() =>
              join.mutate({ slug, data: { productId: product.id, email, name: name || null } })
            }
          >
            <Bell className="w-4 h-4" />
            {join.isPending ? "Saving…" : "Alert Me When Back"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function StorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("pickup");
  const [customerNote, setCustomerNote] = useState("");
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    couponId: number; code: string; discountType: "percentage" | "fixed";
    discountValue: number; discountAmount: number; finalAmount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState("");

  const { data: store, isLoading, error } = useGetPublicStore(slug || "", {
    query: { enabled: !!slug, retry: false }
  });

  const openStatus = useMemo(() => {
    if (!store) return null;
    if (store.temporarilyClosed) {
      return {
        open: false,
        label: (store.temporaryClosedMessage as string | null)?.trim() || "Temporarily Closed",
      };
    }
    if (!store.storeHours) return null;
    return getStoreOpenStatus(store.storeHours as any, store.holidayClosures as string[] | null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.storeHours, store?.holidayClosures, store?.temporarilyClosed, store?.temporaryClosedMessage]);

  const { data: storeReviews = [] } = useGetStoreReviews(slug ?? "", {
    query: { enabled: !!slug },
  });

  const ratingsByProduct = useMemo(() => {
    const map: Record<number, { avg: number; count: number }> = {};
    for (const r of storeReviews) {
      if (!map[r.productId]) map[r.productId] = { avg: 0, count: 0 };
      map[r.productId].count++;
      map[r.productId].avg += r.rating;
    }
    for (const key of Object.keys(map)) {
      map[Number(key)].avg = map[Number(key)].avg / map[Number(key)].count;
    }
    return map;
  }, [storeReviews]);

  const productNameById = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of store?.products ?? []) m[p.id] = p.name;
    return m;
  }, [store?.products]);

  const sortedReviews = useMemo(
    () => [...storeReviews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [storeReviews]
  );

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  const createOrder = useCreateOrder();
  const validateCoupon = useValidateCoupon();

  // Inject OG / social meta tags dynamically so Telegram, Discord, Slack and other
  // JS-executing crawlers pick up the correct title, description and image.
  useEffect(() => {
    if (!store) return;

    const prev = {
      title: document.title,
      desc: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    };

    const setMeta = (sel: string, attr: string, value: string) => {
      let el = document.querySelector<HTMLMetaElement>(sel);
      if (!el) {
        el = document.createElement("meta");
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
      return el;
    };

    const description = store.description
      ?? `Shop ${store.name} on Zapp Store — browse products and order via WhatsApp.`;
    const origin = window.location.origin;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const storeUrl = `${origin}${basePath}/store/${store.slug}`;
    const ogUrl = `${origin}${basePath}/api/og/${store.slug}`;

    document.title = `${store.name} — Zapp Store`;
    setMeta('meta[name="description"]', "content", description);

    const metas: HTMLMetaElement[] = [
      setMeta('meta[property="og:type"]', "content", "website"),
      setMeta('meta[property="og:site_name"]', "content", "Zapp Store"),
      setMeta('meta[property="og:url"]', "content", storeUrl),
      setMeta('meta[property="og:title"]', "content", store.name),
      setMeta('meta[property="og:description"]', "content", description),
      setMeta('meta[name="twitter:card"]', "content", store.logoUrl ? "summary_large_image" : "summary"),
      setMeta('meta[name="twitter:title"]', "content", store.name),
      setMeta('meta[name="twitter:description"]', "content", description),
      setMeta('meta[name="canonical"]', "href", storeUrl),
    ];

    if (store.logoUrl) {
      metas.push(setMeta('meta[property="og:image"]', "content", store.logoUrl));
      metas.push(setMeta('meta[name="twitter:image"]', "content", store.logoUrl));
    }

    // Also set property on the og: tags (some parsers need attribute="property")
    document.querySelectorAll<HTMLMetaElement>('meta[property^="og:"]').forEach(el => {
      el.setAttribute("property", el.getAttribute("property")!);
    });

    void ogUrl; // available for future use (QR, share links, etc.)

    return () => {
      document.title = prev.title;
      metas.forEach(el => el.remove());
    };
  }, [store]);

  const categories = useMemo(() => {
    if (!store?.products) return [];
    const cats = new Set(store.products.map(p => p.category || "All"));
    return Array.from(cats).sort();
  }, [store]);

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const filteredProducts = useMemo(() => {
    if (!store?.products) return [];
    if (activeCategory === "All") return store.products;
    return store.products.filter(p => (p.category || "All") === activeCategory);
  }, [store, activeCategory]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleApplyCoupon = async () => {
    if (!store || !couponInput.trim()) return;
    setCouponError("");
    try {
      const result = await validateCoupon.mutateAsync({
        data: { storeId: store.id, code: couponInput.trim(), orderAmount: cartTotal }
      });
      if (result.valid) {
        setAppliedCoupon({
          couponId: result.couponId!,
          code: couponInput.trim().toUpperCase(),
          discountType: result.discountType!,
          discountValue: result.discountValue!,
          discountAmount: result.discountAmount!,
          finalAmount: result.finalAmount!,
        });
        setCouponInput("");
        toast.success(`Coupon applied! You save ${formatCurrency(result.discountAmount!)}`);
      } else {
        setCouponError(result.error ?? "Invalid coupon");
      }
    } catch {
      setCouponError("Could not validate coupon");
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError("");
  };

  const formatCurrency = (amount: number) => {
    const curr = store?.currency || "USD";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: curr }).format(amount);
  };

  const handleCheckout = async () => {
    if (!store || cart.length === 0) return;

    try {
      const result = await createOrder.mutateAsync({
        data: {
          storeId: store.id,
          customerName,
          customerEmail: customerEmail || null,
          customerPhone,
          customerNote,
          deliveryType,
          couponCode: appliedCoupon?.code ?? null,
          items: cart.map(item => ({
            productId: item.product.id,
            productName: item.product.name,
            price: item.product.price,
            quantity: item.quantity
          }))
        }
      });

      setConfirmation({
        orderId: result.order.id,
        trackingToken: result.order.trackingToken,
        whatsappUrl: result.whatsappUrl,
        storeName: store.name,
      });
      setAppliedCoupon(null);
      setCouponInput("");
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? "Something went wrong. Please try again.";
      toast.error(msg);
    }
  };

  if (isLoading) {
    return <div className="min-h-[100dvh] flex items-center justify-center">Loading store...</div>;
  }

  if (error || !store) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 text-center">
        <Store className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Store Not Found</h1>
        <p className="text-muted-foreground">This store doesn't exist or is currently unavailable.</p>
      </div>
    );
  }

  const isDark = store.theme === "dark";
  const trackingUrl = confirmation
    ? `${window.location.origin}${basePath}/track/${confirmation.trackingToken}`
    : "";

  return (
    <div className={`min-h-[100dvh] ${isDark ? "dark bg-background text-foreground" : "bg-gray-50"}`}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {store.logoUrl ? (
              <img src={store.logoUrl} alt={store.name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
            )}
            <h1 className="font-bold text-xl">{store.name}</h1>
            {openStatus && (
              <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
                openStatus.open
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${openStatus.open ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                {openStatus.label}
              </span>
            )}
          </div>

          <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-full relative">
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">Cart</span>
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold">
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
              <DialogHeader className="p-6 pb-4 border-b">
                <DialogTitle>
                  {confirmation ? "Order Placed! 🎉" : "Your Order"}
                </DialogTitle>
              </DialogHeader>

              {/* Order Confirmation Screen */}
              {confirmation ? (
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  <div className="flex flex-col items-center text-center gap-3 py-2">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-9 h-9 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Order #{confirmation.orderId} Received</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        The store will review your order via WhatsApp. You can track the status anytime with your link below.
                      </p>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-xl p-4 space-y-3 border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Tracking Link</p>
                    <p className="text-sm font-mono break-all text-foreground leading-relaxed">
                      {trackingUrl}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(trackingUrl);
                          toast.success("Tracking link copied!");
                        }}
                      >
                        <Copy className="w-3 h-3" /> Copy Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5 text-xs"
                        onClick={() => window.open(trackingUrl, "_blank")}
                      >
                        <ExternalLink className="w-3 h-3" /> Track Order
                      </Button>
                    </div>
                  </div>

                  <Button
                    className="w-full h-12 gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white"
                    onClick={() => window.open(confirmation.whatsappUrl, "_blank")}
                  >
                    <Send className="w-5 h-5" />
                    Open WhatsApp to Confirm
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-sm text-muted-foreground"
                    onClick={() => {
                      setConfirmation(null);
                      setCart([]);
                      setCustomerName("");
                      setCustomerPhone("");
                      setCustomerNote("");
                      setIsCartOpen(false);
                    }}
                  >
                    Continue Shopping
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-6">
                    {cart.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        Your cart is empty.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="space-y-4">
                          {cart.map((item) => (
                            <div key={item.product.id} className="flex gap-4">
                              <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0">
                                {item.product.imageUrl ? (
                                  <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover rounded" />
                                ) : (
                                  <Package className="w-6 h-6 text-muted-foreground/50" />
                                )}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-sm line-clamp-2">{item.product.name}</h4>
                                <div className="text-sm font-semibold mt-1">{formatCurrency(item.product.price)}</div>
                                <div className="flex items-center gap-3 mt-2">
                                  <Button variant="outline" size="icon" className="w-6 h-6 rounded-full" onClick={() => updateQuantity(item.product.id, -1)}>
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                                  <Button variant="outline" size="icon" className="w-6 h-6 rounded-full" onClick={() => updateQuantity(item.product.id, 1)}>
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="border-t pt-4 space-y-4">
                          {/* Coupon input */}
                          {!appliedCoupon ? (
                            <div className="space-y-1.5">
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Coupon code"
                                  value={couponInput}
                                  onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                                  onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                                  className="font-mono tracking-widest h-9 text-sm"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0 gap-1.5"
                                  onClick={handleApplyCoupon}
                                  disabled={!couponInput.trim() || validateCoupon.isPending}
                                >
                                  <Tag className="w-3.5 h-3.5" />
                                  {validateCoupon.isPending ? "…" : "Apply"}
                                </Button>
                              </div>
                              {couponError && (
                                <p className="text-xs text-destructive">{couponError}</p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm">
                              <div className="flex items-center gap-2 text-green-700 font-medium">
                                <Tag className="w-3.5 h-3.5" />
                                <span className="font-mono tracking-widest">{appliedCoupon.code}</span>
                                <span className="font-normal text-green-600">
                                  {appliedCoupon.discountType === "percentage"
                                    ? `(${appliedCoupon.discountValue}% off)`
                                    : `(${formatCurrency(appliedCoupon.discountValue)} off)`}
                                </span>
                              </div>
                              <button onClick={removeCoupon} className="text-green-500 hover:text-green-700 transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {/* Totals */}
                          {appliedCoupon ? (
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Subtotal</span>
                                <span>{formatCurrency(cartTotal)}</span>
                              </div>
                              <div className="flex justify-between text-sm text-green-600 font-medium">
                                <span>Discount</span>
                                <span>−{formatCurrency(appliedCoupon.discountAmount)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-lg border-t pt-2">
                                <span>Total</span>
                                <span>{formatCurrency(appliedCoupon.finalAmount)}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between font-bold text-lg">
                              <span>Total</span>
                              <span>{formatCurrency(cartTotal)}</span>
                            </div>
                          )}

                          <div className="space-y-3">
                            <Label>Delivery Method</Label>
                            <RadioGroup value={deliveryType} onValueChange={(v: any) => setDeliveryType(v)} className="flex flex-col space-y-1">
                              {store.pickupEnabled && (
                                <div className="flex items-center space-x-2 border p-3 rounded-md">
                                  <RadioGroupItem value="pickup" id="pickup" />
                                  <Label htmlFor="pickup" className="cursor-pointer">Store Pickup</Label>
                                </div>
                              )}
                              {store.deliveryEnabled && (
                                <div className="flex items-center space-x-2 border p-3 rounded-md">
                                  <RadioGroupItem value="delivery" id="delivery" />
                                  <Label htmlFor="delivery" className="cursor-pointer">Delivery</Label>
                                </div>
                              )}
                            </RadioGroup>
                          </div>

                          <div className="space-y-2">
                            <Label>Your Name</Label>
                            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Jane Doe" />
                          </div>

                          <div className="space-y-2">
                            <Label>Email <span className="text-muted-foreground text-xs">(for order updates)</span></Label>
                            <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="jane@example.com" />
                          </div>

                          <div className="space-y-2">
                            <Label>Your Phone (Optional)</Label>
                            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+1234567890" />
                          </div>

                          <div className="space-y-2">
                            <Label>Order Notes / Address</Label>
                            <Textarea
                              value={customerNote}
                              onChange={(e) => setCustomerNote(e.target.value)}
                              placeholder={deliveryType === "delivery" ? "Please provide your full delivery address..." : "Any special requests?"}
                              className="resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {cart.length > 0 && (
                    <div className="p-4 border-t bg-muted/30">
                      <Button
                        className="w-full h-12 text-base gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white"
                        onClick={handleCheckout}
                        disabled={createOrder.isPending || !customerName || (deliveryType === "delivery" && !customerNote)}
                      >
                        <Send className="w-5 h-5" />
                        {createOrder.isPending ? "Placing Order…" : "Place Order"}
                      </Button>
                      {(deliveryType === "delivery" && !customerNote) && (
                        <p className="text-xs text-destructive text-center mt-2">Please provide a delivery address in the notes.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Temporarily Closed Banner */}
      {store.temporarilyClosed && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {(store.temporaryClosedMessage as string | null)?.trim()
                ? store.temporaryClosedMessage as string
                : "We're temporarily closed and not accepting orders right now."}
            </p>
          </div>
        </div>
      )}

      {/* Store Info Banner */}
      <div className="bg-primary/10 border-b border-primary/10">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          {store.description && (
            <p className="text-lg text-foreground/80 max-w-2xl mx-auto mb-4">{store.description}</p>
          )}
          {store.shippingNote && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-background rounded-full text-sm text-muted-foreground shadow-sm">
              <Info className="w-4 h-4 text-primary" />
              {store.shippingNote}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Categories */}
        {categories.length > 1 && (
          <div className="flex overflow-x-auto pb-4 mb-6 gap-2 no-scrollbar">
            <Button
              variant={activeCategory === "All" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setActiveCategory("All")}
            >
              All
            </Button>
            {categories.filter(c => c !== "All").map(c => (
              <Button
                key={c}
                variant={activeCategory === c ? "default" : "outline"}
                className="rounded-full whitespace-nowrap"
                onClick={() => setActiveCategory(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        )}

        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-card rounded-2xl border overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
              <div className="aspect-square bg-muted relative border-b">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
                {product.stock !== null && product.stock <= 0 && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                    <span className="font-bold text-lg rotate-12 bg-background px-4 py-1 rounded shadow-sm border">Out of Stock</span>
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3
                  className="font-semibold text-base leading-tight mb-1 line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => setSelectedProduct(product)}
                >{product.name}</h3>
                {ratingsByProduct[product.id] && (
                  <a href="#reviews" className="flex items-center gap-1 mb-1 w-fit">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-medium text-amber-600">
                      {ratingsByProduct[product.id].avg.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({ratingsByProduct[product.id].count})
                    </span>
                  </a>
                )}
                {product.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">{product.description}</p>
                )}
                <div className="mt-auto pt-3 flex items-center justify-between">
                  <span className="font-bold text-primary">{formatCurrency(product.price)}</span>
                  {product.stock !== null && product.stock <= 0 ? (
                    <WaitlistButton product={product} slug={slug || ""} />
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-full h-8 px-3"
                      onClick={() => addToCart(product)}
                    >
                      Add
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredProducts.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground">
              No products available.
            </div>
          )}
        </div>

        {/* Customer Reviews Section */}
        {sortedReviews.length > 0 && (
          <section id="reviews" className="mt-12 pt-8 border-t space-y-5">
            <div className="flex items-baseline gap-3">
              <h2 className="text-xl font-bold">Customer Reviews</h2>
              <span className="text-sm text-muted-foreground">
                {sortedReviews.length} review{sortedReviews.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="space-y-4">
              {sortedReviews.map((review) => (
                <div key={review.id} className="bg-card rounded-xl border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1">
                      {productNameById[review.productId] && (
                        <span className="inline-block text-xs bg-muted px-2 py-0.5 rounded-full font-medium">
                          {productNameById[review.productId]}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-3.5 h-3.5 ${n <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {review.customerName || "Anonymous"} · {fmtDate(review.createdAt as unknown as string)}
                    </span>
                  </div>

                  {review.comment && (
                    <p className="text-sm text-foreground/80 leading-relaxed">{review.comment}</p>
                  )}

                  {review.merchantReply && (
                    <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5 space-y-0.5">
                      <p className="text-xs font-semibold text-primary">Reply from {store?.name}</p>
                      <p className="text-sm text-foreground/80">{review.merchantReply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Product detail dialog */}
      {selectedProduct && (() => {
        const pReviews = sortedReviews.filter(r => r.productId === selectedProduct.id);
        const pAvg = pReviews.length
          ? pReviews.reduce((s, r) => s + r.rating, 0) / pReviews.length
          : 0;
        const pByStars = [5, 4, 3, 2, 1].map(s => ({
          star: s,
          count: pReviews.filter(r => r.rating === s).length,
        }));
        const inCart = cart.find(i => i.product.id === selectedProduct.id);
        const outOfStock = selectedProduct.stock !== null && selectedProduct.stock !== undefined && selectedProduct.stock <= 0;

        return (
          <Dialog open onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}>
            <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col max-h-[90dvh]">
              <DialogTitle className="sr-only">{selectedProduct.name}</DialogTitle>

              {/* Product image */}
              <div className="aspect-video bg-muted shrink-0 relative">
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-16 h-16 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
                {/* Name + price + description */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-bold leading-tight">{selectedProduct.name}</h2>
                    <span className="text-lg font-bold text-primary shrink-0">{formatCurrency(selectedProduct.price)}</span>
                  </div>
                  {selectedProduct.description && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{selectedProduct.description}</p>
                  )}
                </div>

                {/* Rating summary */}
                {pReviews.length > 0 && (
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-4xl font-bold leading-none">{pAvg.toFixed(1)}</p>
                        <div className="flex gap-0.5 mt-1 justify-center">
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star key={n} className={`w-4 h-4 ${n <= Math.round(pAvg) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{pReviews.length} review{pReviews.length !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {pByStars.map(({ star, count }) => (
                          <div key={star} className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground w-3 text-right">{star}</span>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${pReviews.length ? (count / pReviews.length) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reviews list */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">
                    {pReviews.length > 0 ? "Customer Reviews" : "No reviews yet"}
                  </h3>
                  {pReviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Be the first to review this product after your purchase.</p>
                  ) : (
                    <div className="space-y-4">
                      {pReviews.map(review => (
                        <div key={review.id} className="space-y-2 pb-4 border-b last:border-0 last:pb-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map(n => (
                                <Star key={n} className={`w-3.5 h-3.5 ${n <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {review.customerName || "Anonymous"} · {fmtDate(review.createdAt as unknown as string)}
                            </span>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-foreground/80 leading-relaxed">{review.comment}</p>
                          )}
                          {review.merchantReply && (
                            <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5 space-y-0.5">
                              <p className="text-xs font-semibold text-primary">Reply from {store?.name}</p>
                              <p className="text-sm text-foreground/80">{review.merchantReply}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky add-to-cart footer */}
              <div className="px-5 py-4 border-t shrink-0">
                {outOfStock ? (
                  <WaitlistButton product={selectedProduct} slug={slug || ""} />
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {inCart ? `Add Another · ${inCart.quantity} in cart` : "Add to Cart"}
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
