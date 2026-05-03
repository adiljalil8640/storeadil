import { SignIn, SignUp } from "@clerk/react";
import { useGetReferralPreview } from "@workspace/api-client-react";
import { Gift, Zap, Store } from "lucide-react";
import { motion } from "framer-motion";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function useRefCode(): string | null {
  return new URLSearchParams(window.location.search).get("ref")?.toUpperCase() ?? null;
}

function ReferralBanner({ code }: { code: string }) {
  const { data, isLoading } = useGetReferralPreview(code, {
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  });

  if (isLoading || !data) return null;

  const storeName = data.referrerStoreName;
  const bonus = data.bonusOrders;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mb-4"
    >
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/8 via-primary/5 to-transparent p-5 shadow-sm">
        {/* Top row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">You've been invited!</p>
            {storeName ? (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Store className="w-3 h-3" />
                by <span className="font-medium text-foreground">{storeName}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">via referral link</p>
            )}
          </div>
        </div>

        {/* Bonus highlight */}
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2.5">
          <Zap className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm text-primary font-medium">
            Sign up now and <span className="font-bold">{bonus} bonus orders</span> are waiting for you — free.
          </p>
        </div>

        {/* Code badge */}
        <p className="text-center mt-2.5 text-xs text-muted-foreground">
          Referral code:{" "}
          <span className="font-mono font-semibold text-foreground tracking-wide">{code}</span>
        </p>
      </div>
    </motion.div>
  );
}

export function SignInPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          forceRedirectUrl={`${basePath}/dashboard`}
        />
      </div>
    </div>
  );
}

export function SignUpPage() {
  const refCode = useRefCode();

  // Keep ?ref= in the onboarding redirect so onboarding.tsx can read it
  const onboardingUrl = refCode
    ? `${basePath}/onboarding?ref=${refCode}`
    : `${basePath}/onboarding`;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/30 p-4">
      {refCode && <ReferralBanner code={refCode} />}
      <div className="w-full max-w-md">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          forceRedirectUrl={onboardingUrl}
        />
      </div>
    </div>
  );
}
