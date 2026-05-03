import { useCreateCheckoutSession } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  limitType: "products" | "orders";
  current?: number;
  limit?: number;
  planName?: string;
}

const UPGRADE_FEATURES = [
  "100 products (vs 10 on Free)",
  "500 orders/month (vs 50 on Free)",
  "AI description generator",
  "AI price suggester",
  "Priority support",
];

export function UpgradeModal({ open, onClose, limitType, current, limit, planName }: UpgradeModalProps) {
  const [, setLocation] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const checkout = useCreateCheckoutSession({
    mutation: {
      onSuccess: (data) => { window.location.href = data.url; },
      onError: (err: any) => toast.error(err?.response?.data?.error ?? "Stripe not configured. Add STRIPE_SECRET_KEY."),
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <Badge className="bg-primary text-primary-foreground">Upgrade to Pro</Badge>
          </div>
          <DialogTitle>
            {limitType === "products"
              ? `${planName ?? "Free"} plan limit reached (${current}/${limit} products)`
              : `Monthly order limit reached (${current}/${limit} orders)`}
          </DialogTitle>
          <DialogDescription>
            Upgrade to unlock more capacity and powerful features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 my-2">
          {UPGRADE_FEATURES.map(f => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1"
            onClick={() => checkout.mutate({ data: { planName: "pro" } })}
            disabled={checkout.isPending}
          >
            {checkout.isPending ? "Redirecting..." : "Upgrade to Pro — $19/mo"}
          </Button>
          <Button variant="outline" onClick={() => { onClose(); setLocation(`${basePath}/billing`); }}>
            View Plans
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
