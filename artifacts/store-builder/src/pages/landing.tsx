import { Link } from "wouter";
import { Store, MessageCircle, Zap, TrendingUp, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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
          <div className="flex items-center gap-4">
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
                {/* Mockup representation */}
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
