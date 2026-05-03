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
import { Store, Save, ExternalLink, Copy, QrCode, Share2, MessageCircle, Download, Bell, Tag, Globe, Sparkles, CheckCircle2, XCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Smartphone, Search } from "lucide-react";
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
  const previewName = form.watch("metaTitle") || form.watch("name") || store?.name || "Your Store";
  const previewDesc = form.watch("metaDescription") || form.watch("description") || store?.description || "";
  const previewLogo = store?.logoUrl ?? null;
  const previewDomain = store ? window.location.hostname : "zappstore.app";

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
