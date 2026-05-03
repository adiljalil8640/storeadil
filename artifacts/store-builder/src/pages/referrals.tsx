import { useState } from "react";
import { useGetMyReferral, useApplyReferralCode, getGetMyReferralQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Zap,
  ChevronRight,
  MessageCircle,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const BONUS_PER_REFERRAL = 50;

export default function ReferralsPage() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");
  const [applyError, setApplyError] = useState("");

  const { data, isLoading } = useGetMyReferral();

  const applyMutation = useApplyReferralCode({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyReferralQueryKey() });
        setApplyCode("");
        setApplyError("");
        toast.success("Referral code applied! The referrer received their bonus.");
      },
      onError: (e: any) => {
        const msg = e?.response?.data?.error ?? "Failed to apply code";
        setApplyError(msg);
      },
    },
  });

  const copyLink = async () => {
    if (!data?.referralLink) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    if (!data?.referralLink) return;
    const text = encodeURIComponent(
      `Hey! I'm using Zapp Store to sell on WhatsApp — it's awesome. Sign up with my link and we both get a boost: ${data.referralLink}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareNative = async () => {
    if (!data?.referralLink) return;
    if (navigator.share) {
      await navigator.share({ title: "Join Zapp Store", url: data.referralLink });
    } else {
      copyLink();
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="text-center py-20 text-muted-foreground">Loading your referral info…</div>
      </AppLayout>
    );
  }

  const referredCount = data?.referredCount ?? 0;
  const bonusOrdersEarned = data?.bonusOrdersEarned ?? 0;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Referral Program</h1>
          <p className="text-muted-foreground">
            Invite other merchants to Zapp Store and earn bonus orders for every signup.
          </p>
        </div>

        {/* How it works banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border bg-primary/5 border-primary/20 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-primary" />
            <span className="font-semibold text-primary">How it works</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Share2, label: "Share your link", desc: "Send your unique referral link to other merchants" },
              { icon: Users, label: "They sign up", desc: "They create a Zapp Store using your link" },
              { icon: Zap, label: "You earn orders", desc: `Both of you get ${BONUS_PER_REFERRAL} bonus orders free` },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <step.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{step.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
                {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground/40 hidden sm:block mt-2 shrink-0" />}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}>
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{referredCount}</p>
                    <p className="text-xs text-muted-foreground">Merchants referred</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{bonusOrdersEarned}</p>
                    <p className="text-xs text-muted-foreground">Bonus orders earned</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Your referral link */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-primary" />
              Your referral link
            </CardTitle>
            <CardDescription>Share this link to invite merchants. Each signup earns you {BONUS_PER_REFERRAL} bonus orders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Code badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Your code:</span>
              <Badge variant="outline" className="font-mono text-primary border-primary/30 text-sm px-2.5">
                {data?.referralCode}
              </Badge>
            </div>

            {/* Link input + copy */}
            <div className="flex gap-2">
              <Input
                readOnly
                value={data?.referralLink ?? ""}
                className="font-mono text-xs bg-muted/50 cursor-default"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button variant="outline" onClick={copyLink} className="gap-2 shrink-0">
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            {/* Share buttons */}
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={shareWhatsApp} className="gap-2 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/5">
                <MessageCircle className="w-4 h-4" />
                Share via WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={shareNative} className="gap-2">
                <Share2 className="w-4 h-4" />
                Share link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Apply a referral code */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" />
              Have a referral code?
            </CardTitle>
            <CardDescription>
              Enter a referral code from another merchant to give them {BONUS_PER_REFERRAL} bonus orders. You'll both benefit!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. USER7ABC"
                value={applyCode}
                onChange={(e) => { setApplyCode(e.target.value.toUpperCase()); setApplyError(""); }}
                className="font-mono uppercase"
                maxLength={12}
              />
              <Button
                onClick={() => applyMutation.mutate({ data: { code: applyCode } })}
                disabled={!applyCode.trim() || applyMutation.isPending}
                className="shrink-0"
              >
                {applyMutation.isPending ? "Applying…" : "Apply"}
              </Button>
            </div>
            {applyError && (
              <p className="text-sm text-destructive mt-2">{applyError}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
