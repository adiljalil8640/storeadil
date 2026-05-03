import { Link } from "wouter";
import { Store, MessageCircle, Zap, TrendingUp, CheckCircle2, ArrowRight, ShoppingBag, ExternalLink, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useGetTopStores } from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function StoreInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const colors = [
    "bg-emerald-500",
    "bg-sky-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-teal-500",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
      {initials}
    </div>
  );
}

function TopStoresSection() {
  const { data: stores, isLoading } = useGetTopStores({
    query: { staleTime: 5 * 60 * 1000 },
  });

  // Skeletons while loading
  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted/60 rounded w-1/2" />
              </div>
            </div>
            <div className="h-3 bg-muted/40 rounded w-full mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (!stores || stores.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {stores.map((store, i) => (
        <motion.a
          key={store.id}
          href={`${basePath}/store/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.07 }}
          className="group rounded-2xl border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 p-5 flex flex-col gap-3 cursor-pointer"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt={store.name}
                className="w-12 h-12 rounded-xl object-cover shrink-0"
              />
            ) : (
              <StoreInitials name={store.name} />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm truncate">{store.name}</p>
                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground">@{store.slug}</p>
            </div>
          </div>

          {/* Description */}
          {store.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {store.description}
            </p>
          )}

          {/* Order count badge */}
          <div className="flex items-center gap-1.5 mt-auto pt-1">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/8 border border-primary/15">
              <ShoppingBag className="w-3 h-3 text-primary" />
              <span className="text-xs font-semibold text-primary">
                {store.orderCount.toLocaleString()}{" "}
                {store.orderCount === 1 ? "order" : "orders"}
              </span>
            </div>
          </div>
        </motion.a>
      ))}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Navbar */}
      <nav className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">Zapp Store</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`${basePath}/browse`}>
              <Button variant="ghost" className="hidden sm:inline-flex gap-1.5">
                <LayoutGrid className="w-4 h-4" /> Browse Stores
              </Button>
            </Link>
            <Link href={`${basePath}/sign-in`}>
              <Button variant="ghost" className="hidden sm:inline-flex">Sign In</Button>
            </Link>
            <Link href={`${basePath}/sign-up`}>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-32 px-4 overflow-hidden relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="w-4 h-4" /> The fastest way to sell online
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-balance leading-tight mb-8">
              Your business, now <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-400">living in WhatsApp</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Create a beautiful digital storefront in minutes. Customers browse your products online and send their orders directly to your WhatsApp. No complex checkouts, just instant conversations.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={`${basePath}/sign-up`}>
                <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground">
                  Start Your Store
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground sm:hidden">Free 14-day trial. No credit card required.</p>
            </div>
            <p className="text-sm text-muted-foreground mt-4 hidden sm:block">No coding required • Setup in 3 minutes • Direct WhatsApp orders</p>
          </motion.div>
        </div>
      </section>

      {/* Top Stores Showcase */}
      <section className="py-24 px-4 border-t">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <TrendingUp className="w-4 h-4" /> Live on Zapp Store
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Merchants already selling
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Real stores, real orders — explore some of the businesses growing with Zapp Store today.
            </p>
          </div>
          <TopStoresSection />
          <div className="text-center mt-10">
            <Link href={`${basePath}/sign-up`}>
              <Button variant="outline" size="lg" className="h-12 px-6">
                Join them — create your store free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 bg-muted/30 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Three steps to your first sale</h2>
            <p className="text-muted-foreground text-lg">We handle the storefront, you handle the customers.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-border -z-10"></div>
            
            <div className="text-center relative">
              <div className="w-24 h-24 mx-auto bg-background border-2 border-primary/20 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <span className="text-3xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Tell us what you sell</h3>
              <p className="text-muted-foreground">Our AI instantly generates your store layout, categories, and initial setup.</p>
            </div>
            
            <div className="text-center relative">
              <div className="w-24 h-24 mx-auto bg-background border-2 border-primary/20 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <span className="text-3xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Add your products</h3>
              <p className="text-muted-foreground">Upload photos, set prices, and manage your inventory from a simple dashboard.</p>
            </div>
            
            <div className="text-center relative">
              <div className="w-24 h-24 mx-auto bg-background border-2 border-primary/20 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <span className="text-3xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Get orders on WhatsApp</h3>
              <p className="text-muted-foreground">Customers browse your unique link and checkout directly into your WhatsApp inbox.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Everything you need, nothing you don't</h2>
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-1">Direct Communication</h4>
                    <p className="text-muted-foreground">Close sales faster by chatting directly with customers. No abandoned carts, just conversations.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-1">Simple Analytics</h4>
                    <p className="text-muted-foreground">Track your most popular products and total revenue at a glance from your mobile-friendly dashboard.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-1">Order Management</h4>
                    <p className="text-muted-foreground">Keep track of pending, confirmed, and completed orders so nothing slips through the cracks.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-3xl blur-3xl -z-10"></div>
              <div className="bg-card border rounded-3xl shadow-xl overflow-hidden aspect-[4/3] flex items-center justify-center p-8">
                <div className="w-full max-w-sm bg-background border rounded-2xl shadow-lg overflow-hidden flex flex-col">
                  <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                    <div className="font-semibold text-sm">Store Preview</div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="p-4 flex-1 space-y-4">
                    <div className="w-16 h-16 rounded-lg bg-muted mb-4"></div>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted/50 rounded w-1/2"></div>
                    <div className="pt-4 grid grid-cols-2 gap-2">
                      <div className="h-24 bg-muted rounded-md"></div>
                      <div className="h-24 bg-muted rounded-md"></div>
                    </div>
                  </div>
                  <div className="p-4 border-t bg-primary/5">
                    <div className="h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-medium text-sm gap-2">
                      <MessageCircle className="w-4 h-4" /> Send via WhatsApp
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-primary px-4 text-primary-foreground text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to upgrade your business?</h2>
          <p className="text-primary-foreground/80 text-xl mb-10">Join thousands of merchants using Zapp Store to sell directly on WhatsApp.</p>
          <Link href={`${basePath}/sign-up`}>
            <Button size="lg" variant="secondary" className="h-14 px-8 text-lg text-primary font-semibold hover:bg-background">
              Create Your Free Store
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t px-4 bg-background">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Store className="w-5 h-5" />
            <span className="font-semibold text-foreground">Zapp Store</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Zapp Store. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
