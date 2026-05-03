import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { useClerk } from "@clerk/react";

// Pages
import LandingPage from "@/pages/landing";
import { SignInPage, SignUpPage } from "@/pages/auth";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import ProductsPage from "@/pages/products";
import OrdersPage from "@/pages/orders";
import SettingsPage from "@/pages/settings";
import StorefrontPage from "@/pages/storefront";
import BillingPage from "@/pages/billing";
import AnalyticsPage from "@/pages/analytics";
import AdminPage from "@/pages/admin";
import TrackPage from "@/pages/track";
import CouponsPage from "@/pages/coupons";
import ReviewsPage from "@/pages/reviews";
import WaitlistPage from "@/pages/waitlist";
import ReferralsPage from "@/pages/referrals";
import BrowsePage from "@/pages/browse";
import NotFound from "@/pages/not-found";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
// Clerk proxy only applies in production — dev instances connect directly to FAPI
const clerkProxyUrl = import.meta.env.PROD
  ? (import.meta.env.VITE_CLERK_PROXY_URL ?? `${window.location.origin}/api/__clerk`)
  : undefined;
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
);

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#25D366",
    colorForeground: "#111827",
    colorMutedForeground: "#6B7280",
    colorDanger: "#EF4444",
    colorBackground: "#FFFFFF",
    colorInput: "#F9FAFB",
    colorInputForeground: "#111827",
    colorNeutral: "#E5E7EB",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 font-semibold",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButtonText: "text-gray-700",
    formFieldLabel: "text-gray-700",
    footerActionLink: "text-[#25D366]",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400",
    identityPreviewEditButton: "text-[#25D366]",
    formFieldSuccessText: "text-[#25D366]",
    alertText: "text-gray-700",
    logoBox: "flex justify-center mb-2",
    formButtonPrimary: "bg-[#25D366] hover:bg-[#20bd5a] text-white",
    formFieldInput: "border-gray-200 focus:border-[#25D366] focus:ring-[#25D366]",
    footerAction: "bg-gray-50",
    dividerLine: "bg-gray-200",
    alert: "bg-red-50 border-red-200",
    otpCodeFieldInput: "border-gray-200",
    formFieldRow: "",
    main: "",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener]);

  return null;
}

function HomeRedirect() {
  const [, setLocation] = useLocation();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setLocation(`${basePath}/dashboard`);
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return null;
  if (isSignedIn) return null;
  return <LandingPage />;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [, setLocation] = useLocation();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation(`${basePath}/`);
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return null;
  if (!isSignedIn) return null;
  return <Component />;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  function stripBase(path: string): string {
    return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to manage your store" } },
        signUp: { start: { title: "Create your store", subtitle: "Start selling on WhatsApp today" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          {/* Public routes */}
          <Route path="/browse" component={BrowsePage} />
          <Route path="/store/:slug" component={StorefrontPage} />
          <Route path="/track/:token" component={TrackPage} />

          {/* Protected */}
          <Route path="/onboarding"><ProtectedRoute component={OnboardingPage} /></Route>
          <Route path="/dashboard"><ProtectedRoute component={DashboardPage} /></Route>
          <Route path="/products"><ProtectedRoute component={ProductsPage} /></Route>
          <Route path="/orders"><ProtectedRoute component={OrdersPage} /></Route>
          <Route path="/coupons"><ProtectedRoute component={CouponsPage} /></Route>
          <Route path="/reviews"><ProtectedRoute component={ReviewsPage} /></Route>
          <Route path="/waitlist"><ProtectedRoute component={WaitlistPage} /></Route>
          <Route path="/referrals"><ProtectedRoute component={ReferralsPage} /></Route>
          <Route path="/analytics"><ProtectedRoute component={AnalyticsPage} /></Route>
          <Route path="/billing"><ProtectedRoute component={BillingPage} /></Route>
          <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>
          <Route path="/admin"><ProtectedRoute component={AdminPage} /></Route>

          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
