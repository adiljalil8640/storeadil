import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import {
  Store,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  CreditCard,
  TrendingUp,
  Shield,
  AlertCircle,
  Tag,
  Bell,
  Gift,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetMyStore, useGetBillingStatus, useGetAnalyticsSummary, useListMerchantReviews } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data: store } = useGetMyStore({ query: { enabled: !!user } });
  const { data: billingStatus } = useGetBillingStatus({ query: { enabled: !!user } });
  const { data: analytics } = useGetAnalyticsSummary({ query: { enabled: !!user && !!store } });
  const pendingOrders = analytics?.pendingOrders ?? 0;

  const { data: reviewsData } = useListMerchantReviews(undefined, { query: { enabled: !!user && !!store } });
  const unrepliedReviews = (reviewsData ?? []).filter((r) => !r.merchantReply).length;

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navItems = [
    { href: `${basePath}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `${basePath}/products`, label: "Products", icon: Package },
    { href: `${basePath}/orders`, label: "Orders", icon: ShoppingCart, badge: pendingOrders > 0 ? pendingOrders : undefined },
    { href: `${basePath}/coupons`, label: "Coupons", icon: Tag },
    { href: `${basePath}/reviews`, label: "Reviews", icon: Star, badge: unrepliedReviews > 0 ? unrepliedReviews : undefined },
    { href: `${basePath}/waitlist`, label: "Waitlist", icon: Bell },
    { href: `${basePath}/referrals`, label: "Referrals", icon: Gift },
    { href: `${basePath}/analytics`, label: "Analytics", icon: TrendingUp },
    { href: `${basePath}/billing`, label: "Billing", icon: CreditCard },
    { href: `${basePath}/settings`, label: "Settings", icon: Settings },
    { href: `${basePath}/admin`, label: "Admin", icon: Shield },
  ];

  const NavItem = ({ item, mobile = false }: { item: typeof navItems[0]; mobile?: boolean }) => (
    <Link href={item.href}>
      <Button
        variant="ghost"
        size={mobile ? "lg" : "default"}
        className={cn(
          "w-full justify-start gap-3 transition-colors",
          mobile ? "text-base" : "",
          location === item.href
            ? mobile ? "bg-secondary text-foreground" : "bg-sidebar-accent text-sidebar-accent-foreground"
            : mobile ? "text-muted-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge !== undefined && (
          <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold leading-5 text-center tabular-nums">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
        {item.href.includes("/billing") && billingStatus?.isNearLimit && (
          <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
        )}
      </Button>
    </Link>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-sidebar border-sidebar-border h-full">
        <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Store className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg text-sidebar-foreground">
            {store?.name || "Zapp Store"}
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => <NavItem key={item.href} item={item} />)}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-3">
          {/* Usage mini-bar */}
          {billingStatus && !billingStatus.plan.isUnlimited && (
            <div className="px-1 space-y-1">
              <div className="flex justify-between text-xs text-sidebar-foreground/60">
                <span>Orders this month</span>
                <span>{billingStatus.ordersUsed}/{billingStatus.ordersLimit}</span>
              </div>
              <div className="h-1 rounded-full bg-sidebar-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${billingStatus.isNearLimit ? "bg-yellow-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(billingStatus.usagePercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          {store?.slug && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => window.open(`${basePath}/store/${store.slug}`, "_blank")}
            >
              <ExternalLink className="w-4 h-4" />
              View My Store
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            onClick={() => signOut()}
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b bg-background z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Store className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">{store?.name || "Zapp Store"}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-background z-40 flex flex-col border-t">
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => <NavItem key={item.href} item={item} mobile />)}
          </nav>
          <div className="p-4 border-t space-y-3 pb-8">
            {store?.slug && (
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-start gap-2"
                onClick={() => window.open(`${basePath}/store/${store.slug}`, "_blank")}
              >
                <ExternalLink className="w-5 h-5" />
                View My Store
              </Button>
            )}
            <Button
              variant="ghost"
              size="lg"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => signOut()}
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16 h-full overflow-y-auto bg-muted/20">
        <div className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
