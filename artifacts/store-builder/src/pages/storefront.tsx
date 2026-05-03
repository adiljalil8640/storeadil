import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { useGetPublicStore, useCreateOrder } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Store, ShoppingCart, Plus, Minus, Send, Info, Package, CheckCircle, ExternalLink, Copy } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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

  const { data: store, isLoading, error } = useGetPublicStore(slug || "", {
    query: { enabled: !!slug, retry: false }
  });

  const createOrder = useCreateOrder();

  const categories = useMemo(() => {
    if (!store?.products) return [];
    const cats = new Set(store.products.map(p => p.category || "All"));
    return Array.from(cats).sort();
  }, [store]);

  const [activeCategory, setActiveCategory] = useState<string>("All");

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
                          <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>{formatCurrency(cartTotal)}</span>
                          </div>

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
                <h3 className="font-semibold text-base leading-tight mb-1 line-clamp-2">{product.name}</h3>
                {product.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">{product.description}</p>
                )}
                <div className="mt-auto pt-3 flex items-center justify-between">
                  <span className="font-bold text-primary">{formatCurrency(product.price)}</span>
                  <Button
                    size="sm"
                    className="rounded-full h-8 px-3"
                    disabled={product.stock !== null && product.stock <= 0}
                    onClick={() => addToCart(product)}
                  >
                    Add
                  </Button>
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
      </main>
    </div>
  );
}
