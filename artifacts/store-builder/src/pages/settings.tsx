import { useEffect, useState } from "react";
import { useGetMyStore, useUpdateMyStore, getGetMyStoreQueryKey, useGetShareMessage, useGetQrCode } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Save, ExternalLink, Copy, QrCode, Share2, MessageCircle, Download, Bell, Tag, Globe, Sparkles, CheckCircle2, XCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Smartphone, Search, Link2 } from "lucide-react";
import { STORE_CATEGORIES } from "@/lib/categories";
import { toast } from "sonner";

const settingsSchema = z.object({
  name: z.string().min(2, "Store name is required"),
  description: z.string().optional().nullable(),
  whatsappNumber: z.string().min(5, "WhatsApp number is required"),
  currency: z.string().min(1, "Currency is required"),
  category: z.string().optional().nullable(),
  theme: z.enum(["light", "dark", "minimal"]),
  deliveryEnabled: z.boolean(),
  pickupEnabled: z.boolean(),
  shippingNote: z.string().optional().nullable(),
  notificationEmail: z.string().email("Must be a valid email").optional().nullable().or(z.literal("")),
  digestFrequency: z.enum(["none", "daily", "weekly"]).default("none"),
  metaTitle: z.string().max(60, "Keep it under 60 characters for best results").optional().nullable().or(z.literal("")),
  metaDescription: z.string().max(160, "Keep it under 160 characters for best results").optional().nullable().or(z.literal("")),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [qrBlob, setQrBlob] = useState<string | null>(null);

  const { data: store, isLoading } = useGetMyStore();
  const { data: shareData } = useGetShareMessage({ query: { enabled: !!store } });

  const updateStore = useUpdateMyStore({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyStoreQueryKey() });
        toast.success("Settings saved successfully");
      },
    },
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      description: "",
      whatsappNumber: "",
      currency: "USD",
      category: "",
      theme: "light",
      deliveryEnabled: true,
      pickupEnabled: true,
      shippingNote: "",
      notificationEmail: "",
      digestFrequency: "none" as const,
      metaTitle: "",
      metaDescription: "",
    },
  });

  useEffect(() => {
    if (store) {
      form.reset({
        name: store.name,
        description: store.description,
        whatsappNumber: store.whatsappNumber || "",
        currency: store.currency,
        category: store.category || "",
        theme: store.theme as any,
        deliveryEnabled: store.deliveryEnabled,
        pickupEnabled: store.pickupEnabled,
        shippingNote: store.shippingNote,
        notificationEmail: store.notificationEmail || "",
        digestFrequency: (store.digestFrequency as any) || "none",
        metaTitle: store.metaTitle || "",
        metaDescription: store.metaDescription || "",
      });
    }
  }, [store, form]);

  // Load QR code blob
  useEffect(() => {
    if (!store) return;
    fetch(`${basePath}/api/growth/qr-code`, { headers: { "Accept": "image/png" } })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => { if (blob) setQrBlob(URL.createObjectURL(blob)); })
      .catch(() => {});
  }, [store, basePath]);

  const onSubmit = (values: SettingsFormValues) => {
    updateStore.mutate({ data: values });
  };

  const publicUrl = store ? `${window.location.origin}${basePath}/store/${store.slug}` : "";
  const ogPreviewUrl = store ? `${window.location.origin}${basePath}/api/og/${store.slug}` : "";

  const [previewPlatform, setPreviewPlatform] = useState<"whatsapp" | "slack" | "twitter">("whatsapp");
  const rawMetaTitle = form.watch("metaTitle") ?? "";
  const rawMetaDescription = form.watch("metaDescription") ?? "";
  const previewName = rawMetaTitle || form.watch("name") || store?.name || "Your Store";
  const previewDesc = rawMetaDescription || form.watch("description") || store?.description || "";
  const previewLogo = store?.logoUrl ?? null;
  const previewDomain = store ? window.location.hostname : "zappstore.app";

  // --- SEO score (live, 0–100) ---
  const seoChecks = (() => {
    const titleLen = rawMetaTitle.length;
    const descLen = rawMetaDescription.length;
    const hasTitle = titleLen > 0;
    const titleOptimal = titleLen >= 50 && titleLen <= 60;
    const titleGood = titleLen >= 30 && titleLen < 50;
    const hasDesc = descLen > 0;
    const descOptimal = descLen >= 120 && descLen <= 160;
    const descGood = descLen >= 50 && descLen < 120;
    const hasLogo = !!store?.logoUrl;
    const hasPhone = !!(store?.whatsappNumber);
    const hasCat = !!(store?.category);

    const criteria: { label: string; hint: string; pts: number; earned: number }[] = [
      {
        label: "SEO title set",
        hint: "Add a custom SEO title above",
        pts: 15,
        earned: hasTitle ? 15 : 0,
      },
      {
        label: `Title length ${titleLen > 0 ? `(${titleLen} chars)` : ""}`,
        hint: "Aim for 50–60 characters",
        pts: 15,
        earned: titleOptimal ? 15 : titleGood ? 7 : hasTitle ? 2 : 0,
      },
      {
        label: "SEO description set",
        hint: "Add a custom SEO description above",
        pts: 15,
        earned: hasDesc ? 15 : 0,
      },
      {
        label: `Description length ${descLen > 0 ? `(${descLen} chars)` : ""}`,
        hint: "Aim for 120–160 characters",
        pts: 15,
        earned: descOptimal ? 15 : descGood ? 7 : hasDesc ? 2 : 0,
      },
      {
        label: "Logo uploaded",
        hint: "Upload a logo in General Information",
        pts: 20,
        earned: hasLogo ? 20 : 0,
      },
      {
        label: "WhatsApp number set",
        hint: "Add your number in Contact & Localization",
        pts: 10,
        earned: hasPhone ? 10 : 0,
      },
      {
        label: "Store category chosen",
        hint: "Pick a category in General Information",
        pts: 10,
        earned: hasCat ? 10 : 0,
      },
    ];

    const score = criteria.reduce((s, c) => s + c.earned, 0);
    return { score, criteria };
  })();
  const { score: seoScore, criteria: seoCriteria } = seoChecks;
  const seoColor = seoScore >= 75 ? "#16a34a" : seoScore >= 50 ? "#d97706" : "#dc2626";
  const seoLabel = seoScore >= 75 ? "Great" : seoScore >= 50 ? "Good" : "Needs work";
  const ringR = 38;
  const ringCircumference = 2 * Math.PI * ringR;
  const ringOffset = ringCircumference * (1 - seoScore / 100);

  // --- Slug customisation ---
  const [slugInput, setSlugInput] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "current">("idle");
  const [slugSaving, setSlugSaving] = useState(false);

  useEffect(() => {
    if (!slugInput || !store) { setSlugStatus("idle"); return; }
    if (slugInput === store.slug) { setSlugStatus("current"); return; }
    if (slugInput.length < 3) { setSlugStatus("idle"); return; }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slugInput)) { setSlugStatus("invalid"); return; }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${basePath}/api/stores/slug-check?slug=${encodeURIComponent(slugInput)}`);
        const d = await r.json();
        setSlugStatus(d.available ? "available" : d.reason === "current" ? "current" : "taken");
      } catch { setSlugStatus("idle"); }
    }, 500);
    return () => clearTimeout(t);
  }, [slugInput, store, basePath]);

  const handleSlugSave = async () => {
    if (slugStatus !== "available" || slugSaving) return;
    setSlugSaving(true);
    try {
      const r = await fetch(`${basePath}/api/stores/me/slug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slugInput }),
      });
      if (!r.ok) {
        const e = await r.json();
        toast.error(e.error ?? "Failed to change URL");
      } else {
        toast.success("Store URL updated!");
        setSlugInput("");
        setSlugStatus("idle");
        queryClient.invalidateQueries({ queryKey: getGetMyStoreQueryKey() });
      }
    } catch { toast.error("Failed to change URL"); }
    finally { setSlugSaving(false); }
  };

  // --- Custom domain ---
  const [domainInput, setDomainInput] = useState("");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainChecking, setDomainChecking] = useState(false);
  const [domainStatus, setDomainStatus] = useState<{
    status: "pointing" | "not-pointing" | "not-found" | "error" | "unconfigured";
    cnames?: string[];
    replitDomain?: string | null;
  } | null>(null);

  const handleDomainSave = async () => {
    const d = domainInput.trim().toLowerCase();
    if (!d || !d.includes(".")) return;
    setDomainSaving(true);
    try {
      const r = await fetch(`${basePath}/api/stores/me/domain`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      if (!r.ok) { toast.error((await r.json()).error ?? "Failed to save domain"); }
      else {
        toast.success("Custom domain saved!");
        setDomainInput("");
        setDomainStatus(null);
        queryClient.invalidateQueries({ queryKey: getGetMyStoreQueryKey() });
      }
    } catch { toast.error("Failed to save domain"); }
    finally { setDomainSaving(false); }
  };

  const handleDomainRemove = async () => {
    setDomainSaving(true);
    try {
      const r = await fetch(`${basePath}/api/stores/me/domain`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: null }),
      });
      if (!r.ok) { toast.error((await r.json()).error ?? "Failed to remove domain"); }
      else {
        toast.success("Custom domain removed");
        setDomainStatus(null);
        queryClient.invalidateQueries({ queryKey: getGetMyStoreQueryKey() });
      }
    } catch { toast.error("Failed to remove domain"); }
    finally { setDomainSaving(false); }
  };

  const handleDomainCheck = async () => {
    setDomainChecking(true);
    try {
      const r = await fetch(`${basePath}/api/stores/me/domain-status`);
      setDomainStatus(await r.json());
    } catch { toast.error("DNS check failed"); }
    finally { setDomainChecking(false); }
  };

  type VerifyResult = { tags: Record<string, string | null>; storeUrl: string };
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(true);

  const REQUIRED_TAGS = ["og:title", "og:description", "og:url", "og:type"];
  const RECOMMENDED_TAGS = ["og:image", "og:site_name", "twitter:card", "twitter:title", "twitter:description"];

  type HealthStatus = "idle" | "loading" | "good" | "warn" | "error";
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("idle");

  // Silent background fetch to populate the header health badge
  useEffect(() => {
    if (!store) return;
    setHealthStatus("loading");
    fetch(`${basePath}/api/og/${store.slug}/meta`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { tags: Record<string, string | null> } | null) => {
        if (!data) { setHealthStatus("error"); return; }
        const allRequired = REQUIRED_TAGS.every(k => data.tags[k]);
        const allRecommended = RECOMMENDED_TAGS.every(k => data.tags[k]);
        setHealthStatus(allRequired && allRecommended ? "good" : allRequired ? "warn" : "error");
      })
      .catch(() => setHealthStatus("error"));
  }, [store, basePath]);

  const handleVerify = async () => {
    if (!store) return;
    setVerifying(true);
    setVerifyResult(null);
    setVerifyError(null);
    try {
      const res = await fetch(`${basePath}/api/og/${store.slug}/meta`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data: VerifyResult = await res.json();
      setVerifyResult(data);
      setVerifyOpen(true);
    } catch (e: any) {
      setVerifyError(e?.message ?? "Could not reach the preview endpoint.");
    } finally {
      setVerifying(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Store link copied to clipboard");
  };

  const downloadQr = () => {
    if (!qrBlob) return;
    const a = document.createElement("a");
    a.href = qrBlob;
    a.download = `${store?.slug ?? "store"}-qr.png`;
    a.click();
    toast.success("QR code downloaded!");
  };

  const shareOnWhatsApp = () => {
    const msg = shareData?.message ?? `Check out my store: ${publicUrl}`;
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading settings...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Manage your store preferences and configuration.</p>
          </div>

          {/* OG Preview Health Badge */}
          {healthStatus !== "idle" && (
            <div className="shrink-0 mt-1">
              {healthStatus === "loading" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                  Checking preview…
                </span>
              )}
              {healthStatus === "good" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Preview ready
                </span>
              )}
              {healthStatus === "warn" && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
                  title="Add a logo to enable image previews on WhatsApp and Twitter"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Add a logo for richer previews
                </span>
              )}
              {healthStatus === "error" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Preview needs attention
                </span>
              )}
            </div>
          )}
        </div>

        {store && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Store className="w-5 h-5 text-primary" />
                  Your Public Store Link
                </h3>
                <p className="text-sm text-muted-foreground mt-1 break-all">{publicUrl}</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" className="flex-1 sm:flex-none gap-2 bg-background" onClick={copyUrl}>
                  <Copy className="w-4 h-4" /> Copy
                </Button>
                <Button className="flex-1 sm:flex-none gap-2" onClick={() => window.open(publicUrl, "_blank")}>
                  <ExternalLink className="w-4 h-4" /> Visit
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Growth: QR Code + WhatsApp Share */}
        {store && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="w-4 h-4 text-primary" />
                  QR Code
                </CardTitle>
                <CardDescription>Print or share this QR code to drive traffic to your store.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {qrBlob ? (
                  <img src={qrBlob} alt="Store QR Code" className="w-40 h-40 rounded-lg border" />
                ) : (
                  <div className="w-40 h-40 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground text-sm">
                    Loading QR…
                  </div>
                )}
                <Button variant="outline" className="gap-2 w-full" onClick={downloadQr} disabled={!qrBlob}>
                  <Download className="w-4 h-4" />
                  Download QR Code
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Share2 className="w-4 h-4 text-primary" />
                  Share Your Store
                </CardTitle>
                <CardDescription>Send a pre-written message to your contacts on WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {shareData?.message && (
                  <div className="bg-muted/60 rounded-lg p-3 text-sm text-muted-foreground italic line-clamp-4 border">
                    "{shareData.message}"
                  </div>
                )}
                <Button
                  className="gap-2 w-full bg-[#25D366] hover:bg-[#20bd5a] text-white"
                  onClick={shareOnWhatsApp}
                >
                  <MessageCircle className="w-4 h-4" />
                  Share on WhatsApp
                </Button>
                <Button variant="outline" className="gap-2 w-full" onClick={() => {
                  navigator.clipboard.writeText(shareData?.message ?? publicUrl);
                  toast.success("Share message copied!");
                }}>
                  <Copy className="w-4 h-4" />
                  Copy Message
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Link Preview Simulator */}
        {store && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Link Preview Simulator
              </CardTitle>
              <CardDescription>
                See exactly how your store looks when someone pastes your link. Updates live as you edit your name and description below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Platform tabs */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                {(["whatsapp", "slack", "twitter"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreviewPlatform(p)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      previewPlatform === p
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p === "whatsapp" ? "WhatsApp" : p === "slack" ? "Slack" : "Twitter / X"}
                  </button>
                ))}
              </div>

              {/* WhatsApp Preview */}
              {previewPlatform === "whatsapp" && (
                <div className="flex justify-center">
                  <div className="w-full max-w-[340px] bg-[#DCF8C6] rounded-2xl rounded-tl-sm shadow-sm p-0 overflow-hidden">
                    {previewLogo ? (
                      <div className="w-full h-40 bg-muted overflow-hidden">
                        <img src={previewLogo} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-32 bg-[#25D366]/10 flex items-center justify-center">
                        <Store className="w-12 h-12 text-[#25D366]/40" />
                      </div>
                    )}
                    <div className="px-3 py-2 space-y-0.5 border-l-4 border-[#25D366] bg-[#F0FBF4] mx-2 my-2 rounded">
                      <p className="text-[10px] font-semibold text-[#25D366] uppercase tracking-wide">{previewDomain}</p>
                      <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1">{previewName}</p>
                      {previewDesc && (
                        <p className="text-xs text-gray-600 leading-snug line-clamp-2">{previewDesc}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Slack Preview */}
              {previewPlatform === "slack" && (
                <div className="flex justify-center">
                  <div className="w-full max-w-[420px] bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="flex">
                      <div className="w-1 bg-[#25D366] shrink-0" />
                      <div className="flex-1 p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          {previewLogo ? (
                            <img src={previewLogo} alt="" className="w-4 h-4 rounded object-cover" />
                          ) : (
                            <div className="w-4 h-4 bg-[#25D366]/20 rounded flex items-center justify-center">
                              <Store className="w-2.5 h-2.5 text-[#25D366]" />
                            </div>
                          )}
                          <span className="text-xs font-semibold text-gray-800">Zapp Store</span>
                        </div>
                        <p className="text-sm font-bold text-[#1264A3] hover:underline cursor-pointer line-clamp-1">{previewName}</p>
                        {previewDesc && (
                          <p className="text-xs text-gray-700 leading-snug line-clamp-3">{previewDesc}</p>
                        )}
                        <p className="text-[10px] text-gray-400 pt-0.5">{previewDomain}</p>
                      </div>
                      {previewLogo && (
                        <div className="w-20 h-20 shrink-0 overflow-hidden m-3 rounded">
                          <img src={previewLogo} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Twitter / X Preview */}
              {previewPlatform === "twitter" && (
                <div className="flex justify-center">
                  <div className="w-full max-w-[400px] border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                    {previewLogo ? (
                      <div className="w-full h-44 overflow-hidden bg-muted">
                        <img src={previewLogo} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-36 bg-muted flex items-center justify-center">
                        <Store className="w-10 h-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="px-3 py-2.5 space-y-0.5 bg-white">
                      <p className="text-[11px] text-gray-500">{previewDomain}</p>
                      <p className="text-sm font-bold text-gray-900 line-clamp-1">{previewName}</p>
                      {previewDesc && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-snug">{previewDesc}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Verify button */}
              <div className="pt-1 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleVerify}
                  disabled={verifying || !store}
                >
                  {verifying ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  )}
                  {verifying ? "Checking live tags…" : "Verify My Preview"}
                </Button>

                {/* Error state */}
                {verifyError && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}

                {/* Results panel */}
                {verifyResult && (
                  <div className="mt-3 rounded-lg border overflow-hidden">
                    {/* Header */}
                    <button
                      type="button"
                      onClick={() => setVerifyOpen(o => !o)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 text-xs font-semibold hover:bg-muted transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        Live tags confirmed — what crawlers see right now
                      </span>
                      {verifyOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>

                    {verifyOpen && (
                      <div className="divide-y text-xs">
                        {Object.entries(verifyResult.tags).map(([key, value]) => {
                          const isRequired = REQUIRED_TAGS.includes(key);
                          const isRecommended = RECOMMENDED_TAGS.includes(key);
                          const present = value !== null && value !== "";
                          return (
                            <div key={key} className="flex items-start gap-2 px-3 py-2 hover:bg-muted/30">
                              <div className="mt-0.5 shrink-0">
                                {present ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                ) : isRequired ? (
                                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                                ) : (
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded text-foreground">{key}</code>
                                  {isRequired && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">required</span>
                                  )}
                                  {isRecommended && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">recommended</span>
                                  )}
                                </div>
                                {present ? (
                                  <p className="mt-0.5 text-muted-foreground truncate">{value}</p>
                                ) : (
                                  <p className="mt-0.5 text-destructive/70 italic">
                                    {isRequired ? "Missing — required for previews to work" : "Not set — add a logo or description to fill this"}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Summary footer */}
                    <div className="px-3 py-2 bg-muted/30 text-[10px] text-muted-foreground flex items-center justify-between border-t">
                      <span>
                        {Object.values(verifyResult.tags).filter(v => v !== null && v !== "").length} of {Object.keys(verifyResult.tags).length} tags present
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const phone = (store?.whatsappNumber ?? "").replace(/\D/g, "");
                            const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
                            window.open(`${base}?text=${encodeURIComponent(ogPreviewUrl)}`, "_blank");
                          }}
                          className="flex items-center gap-1 hover:text-foreground transition-colors text-[#25D366]"
                        >
                          <Smartphone className="w-2.5 h-2.5" /> Test on phone
                        </button>
                        <button type="button" onClick={handleVerify} className="flex items-center gap-1 hover:text-foreground transition-colors">
                          <RefreshCw className="w-2.5 h-2.5" /> Re-check
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Preview updates as you type — save your settings to publish changes.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Social Preview Link */}
        {store && (
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-primary" />
                Social Preview Link
              </CardTitle>
              <CardDescription>
                Share this link on WhatsApp, Instagram, X, or any platform to show a rich preview card — with your store name, description, and logo automatically displayed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 border text-sm font-mono text-muted-foreground break-all">
                <Globe className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span className="flex-1 truncate">{ogPreviewUrl}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(ogPreviewUrl);
                    toast.success("Social preview link copied!");
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </Button>
                <Button
                  className="flex-1 gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white"
                  onClick={() => {
                    const msg = `🛍️ Check out my store *${store.name}*!\n\n${ogPreviewUrl}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Share on WhatsApp
                </Button>
              </div>

              {/* Send to myself — opens a chat with their own WhatsApp number */}
              <Button
                variant="outline"
                className="w-full gap-2 border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/5 hover:border-[#25D366]"
                onClick={() => {
                  const phone = (store.whatsappNumber ?? "").replace(/\D/g, "");
                  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
                  window.open(`${base}?text=${encodeURIComponent(ogPreviewUrl)}`, "_blank");
                }}
              >
                <Smartphone className="w-4 h-4" />
                Send to Myself — see the preview card on my phone
              </Button>

              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                WhatsApp, iMessage, and Slack will show a preview card. Telegram and Discord see it too — even without running JavaScript.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Store URL / slug customisation card */}
        {store && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                Store URL
              </CardTitle>
              <CardDescription>
                Your storefront is live at the address below. You can change the handle at any time — but note that existing shared links will stop working immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current URL read-only display */}
              <div className="flex items-center gap-2 rounded-lg bg-muted/60 border px-3 py-2.5 text-sm font-mono">
                <Globe className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground truncate">
                  {window.location.origin}{basePath}/store/
                </span>
                <span className="font-semibold text-foreground">{store.slug}</span>
                <button
                  type="button"
                  className="ml-auto shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("URL copied!"); }}
                  title="Copy URL"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* New slug input */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Change Handle</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={slugInput}
                      onChange={(e) =>
                        setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                      }
                      placeholder={store.slug}
                      className="pr-8 font-mono"
                      maxLength={50}
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      {slugStatus === "checking" && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      {slugStatus === "available" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                      {(slugStatus === "taken" || slugStatus === "invalid") && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                      {slugStatus === "current" && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                  </div>
                  <Button
                    type="button"
                    disabled={slugStatus !== "available" || slugSaving}
                    onClick={handleSlugSave}
                    className="gap-2 shrink-0"
                  >
                    {slugSaving
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Save className="w-3.5 h-3.5" />}
                    {slugSaving ? "Saving…" : "Change URL"}
                  </Button>
                </div>

                {/* Inline status message */}
                {slugInput.length > 0 && (
                  <p className={`text-xs flex items-center gap-1.5 ${
                    slugStatus === "available" ? "text-green-600 dark:text-green-400" :
                    slugStatus === "taken" || slugStatus === "invalid" ? "text-destructive" :
                    slugStatus === "current" ? "text-amber-600 dark:text-amber-500" :
                    "text-muted-foreground"
                  }`}>
                    {slugStatus === "available" && <><CheckCircle2 className="w-3 h-3 shrink-0" /> <strong>{slugInput}</strong> is available — click "Change URL" to save</>}
                    {slugStatus === "taken"     && <><XCircle className="w-3 h-3 shrink-0" /> <strong>{slugInput}</strong> is already taken — try a different name</>}
                    {slugStatus === "invalid"   && <><XCircle className="w-3 h-3 shrink-0" /> Use 3–50 lowercase letters, numbers, and hyphens (no leading/trailing hyphens)</>}
                    {slugStatus === "current"   && <><AlertCircle className="w-3 h-3 shrink-0" /> That's already your current handle</>}
                    {slugStatus === "checking"  && "Checking availability…"}
                    {slugStatus === "idle"      && slugInput.length >= 1 && slugInput.length < 3 && "Keep typing — minimum 3 characters"}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  3–50 characters · lowercase letters, numbers, and hyphens only · cannot start or end with a hyphen
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Custom Domain card */}
        {store && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Custom Domain
              </CardTitle>
              <CardDescription>
                Point your own domain (e.g. <code className="text-xs bg-muted px-1 py-0.5 rounded">shop.mybrand.com</code>) to your store so customers see a branded URL instead of a Replit address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {store.customDomain ? (
                /* --- Domain already set --- */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Current custom domain</p>
                      <p className="font-mono text-sm font-semibold truncate">{store.customDomain}</p>
                    </div>
                    {domainStatus && domainStatus.status !== "unconfigured" && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        domainStatus.status === "pointing"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : domainStatus.status === "not-pointing"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {domainStatus.status === "pointing" ? "✓ Pointing" :
                         domainStatus.status === "not-pointing" ? "~ Wrong target" : "✕ Not found"}
                      </span>
                    )}
                    <Button
                      type="button" size="sm" variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive text-xs"
                      disabled={domainSaving}
                      onClick={handleDomainRemove}
                    >
                      {domainSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Remove"}
                    </Button>
                  </div>

                  {/* DNS check result banner */}
                  {domainStatus?.status === "pointing" && (
                    <div className="rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 px-4 py-3 text-xs text-green-800 dark:text-green-300 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <p>DNS is correctly configured. Your store is accessible at <strong>{store.customDomain}</strong> once deployed with this domain in Replit.</p>
                    </div>
                  )}
                  {domainStatus?.status === "not-pointing" && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-medium">CNAME found but pointing to the wrong target.</p>
                        <p>Current value: <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">{domainStatus.cnames?.[0]}</code></p>
                        <p>Expected: <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">{domainStatus.replitDomain ?? window.location.hostname}</code></p>
                      </div>
                    </div>
                  )}
                  {(domainStatus?.status === "not-found" || domainStatus?.status === "error") && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 px-4 py-3 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <p>No DNS record found for <strong>{store.customDomain}</strong>. Add the CNAME below and wait a few minutes before checking again.</p>
                    </div>
                  )}

                  <Button
                    type="button" variant="outline" size="sm" className="gap-2"
                    disabled={domainChecking}
                    onClick={handleDomainCheck}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${domainChecking ? "animate-spin" : ""}`} />
                    {domainChecking ? "Checking DNS…" : "Check DNS"}
                  </Button>
                </div>
              ) : (
                /* --- No domain set yet --- */
                <div className="space-y-2">
                  <label className="text-sm font-medium">Domain</label>
                  <div className="flex gap-2">
                    <Input
                      value={domainInput}
                      onChange={(e) =>
                        setDomainInput(
                          e.target.value
                            .toLowerCase()
                            .replace(/^https?:\/\//, "")
                            .replace(/[^a-z0-9.-]/g, "")
                        )
                      }
                      placeholder="shop.mybrand.com"
                      className="font-mono flex-1"
                    />
                    <Button
                      type="button"
                      disabled={!domainInput.trim() || !domainInput.includes(".") || domainSaving}
                      onClick={handleDomainSave}
                      className="gap-2 shrink-0"
                    >
                      {domainSaving
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Save className="w-3.5 h-3.5" />}
                      {domainSaving ? "Saving…" : "Save Domain"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter without <code className="bg-muted px-1 rounded">https://</code> — e.g. <code className="bg-muted px-1 rounded">shop.mybrand.com</code>
                  </p>
                </div>
              )}

              {/* DNS setup instructions — always visible */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-primary" />
                  DNS Setup Instructions
                </p>
                <p className="text-xs text-muted-foreground">
                  Log in to your domain registrar (Cloudflare, Namecheap, GoDaddy, etc.) and add this record:
                </p>

                {/* CNAME record table */}
                <div className="rounded-lg border bg-background overflow-x-auto text-xs font-mono">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Value</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">TTL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2.5 text-foreground font-semibold">CNAME</td>
                        <td className="px-3 py-2.5 text-foreground">@ <span className="text-muted-foreground font-normal">(or subdomain)</span></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-primary font-semibold">{window.location.hostname}</span>
                            <button
                              type="button"
                              title="Copy CNAME target"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => { navigator.clipboard.writeText(window.location.hostname); toast.success("CNAME target copied!"); }}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">Auto</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <ul className="text-xs text-muted-foreground space-y-1 list-none">
                  <li>• DNS changes can take <strong className="text-foreground">5–60 minutes</strong> to propagate globally.</li>
                  <li>• After adding the record, use <strong className="text-foreground">Check DNS</strong> above to verify it's pointing correctly.</li>
                  <li>• For the domain to serve your store publicly, also add it in your <strong className="text-foreground">Replit deployment settings</strong>.</li>
                </ul>

                <a
                  href="https://docs.replit.com/hosting/deployments/custom-domains"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Replit custom domain guide
                </a>
              </div>

            </CardContent>
          </Card>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>General Information</CardTitle>
                <CardDescription>Basic details about your business.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea className="resize-none min-h-[100px]" {...field} value={field.value || ""} /></FormControl>
                      <FormDescription>Displayed on your public storefront.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-primary" />
                        Store Category
                      </FormLabel>
                      <FormDescription className="mt-0 mb-3">
                        Choose a category so customers can find your store more easily in the browse directory.
                      </FormDescription>
                      <div className="flex flex-wrap gap-2">
                        {STORE_CATEGORIES.map((cat) => {
                          const active = field.value === cat.value;
                          return (
                            <button
                              key={cat.value}
                              type="button"
                              onClick={() => field.onChange(active ? "" : cat.value)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                                active
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted/50"
                              }`}
                            >
                              <span>{cat.emoji}</span>
                              <span>{cat.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact &amp; Localization</CardTitle>
                <CardDescription>How customers reach you and how prices are displayed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="whatsappNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp Number</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormDescription>Include country code (e.g. +1234567890)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                            <SelectItem value="BRL">BRL (R$)</SelectItem>
                            <SelectItem value="INR">INR (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fulfillment Options</CardTitle>
                <CardDescription>Configure how customers receive their orders.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="deliveryEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Allow Delivery</FormLabel>
                          <FormDescription>Customers can request delivery to their address.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pickupEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Allow Store Pickup</FormLabel>
                          <FormDescription>Customers can pick up their orders in person.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="shippingNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping / Delivery Policy (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="E.g. Free delivery within 5 miles. Orders take 2 days to process."
                          className="resize-none"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  Notifications &amp; Digest
                </CardTitle>
                <CardDescription>Get instant order alerts and scheduled sales summaries by email.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="notificationEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notification Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Receives instant new-order alerts and digest reports. Requires <code className="text-xs bg-muted px-1 py-0.5 rounded">RESEND_API_KEY</code> on the server.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="digestFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Digest</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Disabled</SelectItem>
                          <SelectItem value="daily">Daily — every morning at 8 AM UTC</SelectItem>
                          <SelectItem value="weekly">Weekly — every Monday at 8 AM UTC</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Receive a summary of orders, revenue, and top products for the previous day or week.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Store SEO card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  Store SEO &amp; Link Preview Text
                </CardTitle>
                <CardDescription>
                  Craft a title and description specifically for search engines, WhatsApp previews, and social sharing — separate from what customers see on your storefront. Leave blank to use your store name and description automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* SEO Score ring */}
                <div className="rounded-xl border bg-muted/20 px-5 py-4 flex items-start gap-5">
                  {/* Ring */}
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <svg width="90" height="90" viewBox="0 0 90 90">
                      {/* Track */}
                      <circle
                        cx="45" cy="45" r={ringR}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="7"
                        className="text-muted/40"
                      />
                      {/* Progress */}
                      <circle
                        cx="45" cy="45" r={ringR}
                        fill="none"
                        stroke={seoColor}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        transform="rotate(-90 45 45)"
                        style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
                      />
                      <text x="45" y="42" textAnchor="middle" dominantBaseline="middle"
                        fill={seoColor} fontSize="18" fontWeight="700" fontFamily="inherit">
                        {seoScore}
                      </text>
                      <text x="45" y="57" textAnchor="middle" dominantBaseline="middle"
                        fill={seoColor} fontSize="9" fontWeight="500" fontFamily="inherit">
                        {seoLabel}
                      </text>
                    </svg>
                    <span className="text-[10px] text-muted-foreground">out of 100</span>
                  </div>
                  {/* Criteria */}
                  <div className="flex-1 min-w-0 space-y-1.5 pt-1">
                    <p className="text-xs font-semibold text-foreground mb-2">SEO Score Breakdown</p>
                    {seoCriteria.map((c) => {
                      const full = c.earned === c.pts;
                      const partial = c.earned > 0 && c.earned < c.pts;
                      return (
                        <div key={c.label} className="flex items-center gap-2 text-xs">
                          <span className={`shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded-full text-[9px] font-bold
                            ${full ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                              partial ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                              "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                            {full ? "✓" : partial ? "~" : "✕"}
                          </span>
                          <span className={`flex-1 truncate ${full ? "text-foreground" : "text-muted-foreground"}`}>
                            {full ? c.label : c.hint}
                          </span>
                          <span className={`tabular-nums font-medium shrink-0 ${full ? "text-green-600 dark:text-green-400" : partial ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            {c.earned}/{c.pts}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="metaTitle"
                  render={({ field }) => {
                    const len = (field.value ?? "").length;
                    return (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>SEO Title</FormLabel>
                          <span className={`text-xs tabular-nums ${len > 55 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                            {len}/60
                          </span>
                        </div>
                        <FormControl>
                          <Input
                            placeholder={`${store?.name ?? "Your Store"} — Zapp Store`}
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Shown in search results and browser tabs. Aim for 50–60 characters. Falls back to your store name.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="metaDescription"
                  render={({ field }) => {
                    const len = (field.value ?? "").length;
                    return (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>SEO Description</FormLabel>
                          <span className={`text-xs tabular-nums ${len > 150 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                            {len}/160
                          </span>
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder={store?.description ?? "Describe what makes your store special…"}
                            className="resize-none"
                            rows={3}
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Shown in search snippets, WhatsApp previews, and link cards. Aim for 120–160 characters. Falls back to your store description.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                {/* Live Google/Bing snippet preview */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-muted-foreground" />
                    Search Result Preview
                  </p>
                  <div className="rounded-xl border bg-background px-5 py-4 shadow-sm space-y-3">
                    {/* Google-style result */}
                    <div className="space-y-0.5">
                      {/* Site identity row */}
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-border flex items-center justify-center">
                          <Globe className="w-2.5 h-2.5 text-primary" />
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs font-medium text-foreground leading-none">Zapp Store</span>
                          <span className="text-[11px] text-muted-foreground leading-none mt-0.5">
                            {store
                              ? `${window.location.hostname} › store › ${store.slug}`
                              : "zappstore.app › store › your-store"}
                          </span>
                        </div>
                      </div>
                      {/* Title */}
                      <p className="text-[#1a0dab] dark:text-[#8ab4f8] text-lg font-normal leading-snug line-clamp-1 cursor-pointer hover:underline">
                        {previewName
                          ? `${previewName} — Zapp Store`
                          : `${store?.name ?? "Your Store"} — Zapp Store`}
                      </p>
                      {/* Description */}
                      <p className="text-[13px] text-[#4d5156] dark:text-[#bdc1c6] leading-snug line-clamp-2">
                        {previewDesc
                          ? previewDesc.slice(0, 160)
                          : `Shop ${store?.name ?? "Your Store"} on Zapp Store — browse products and order via WhatsApp.`}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground border-t pt-2">
                      Updates live as you type above. This is how Google and Bing display your store.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-primary" /> How this works
                  </p>
                  <p>When someone pastes your preview link on WhatsApp, Slack, or Twitter, they see your <strong>SEO Title</strong> as the headline and your <strong>SEO Description</strong> as the body — not the description on your storefront page.</p>
                  <p>This lets you write one message for shoppers ("Browse handmade candles…") and a punchier hook for sharing ("🕯️ Handmade soy candles — free shipping this weekend").</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" size="lg" className="gap-2" disabled={updateStore.isPending}>
                <Save className="w-4 h-4" />
                {updateStore.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
