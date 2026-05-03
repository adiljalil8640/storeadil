import { useEffect, useState } from "react";
import { useGetMyStore, useUpdateMyStore, getGetMyStoreQueryKey, useGetShareMessage, useGetQrCode, useGetMyStoreDigestPreview, useGetWhatsappConfig, useUpdateWhatsappConfig, useGetWhatsappStatus, useConnectWhatsapp, useDisconnectWhatsapp } from "@workspace/api-client-react";
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
import { Store, Save, ExternalLink, Copy, QrCode, Share2, MessageCircle, Download, Bell, Tag, Globe, Sparkles, CheckCircle2, XCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Smartphone, Search, Link2, Clock, CalendarDays, X, AlertTriangle, Eye, EyeOff, TrendingUp, ShoppingCart, Package, Bot, Zap, WifiOff, ScanLine, SendHorizonal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STORE_CATEGORIES } from "@/lib/categories";
import { toast } from "sonner";
import QRCode from "qrcode";

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
  const [digestPreviewOpen, setDigestPreviewOpen] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);

  const { data: store, isLoading } = useGetMyStore();
  const { data: digestData, isFetching: digestFetching, refetch: refetchDigest } = useGetMyStoreDigestPreview({
    query: { enabled: false },
  });
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

  async function sendTestEmail() {
    setTestEmailSending(true);
    try {
      const res = await fetch(`${basePath}/api/stores/me/send-test-notification`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to send test email");
      } else {
        toast.success(`Test email sent to ${body.sentTo}`);
        setTestEmailSent(true);
        setTimeout(() => setTestEmailSent(false), 4000);
      }
    } catch {
      toast.error("Failed to send test email");
    } finally {
      setTestEmailSending(false);
    }
  }

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

  // --- WhatsApp Auto-Reply ---
  const [waMode, setWaMode] = useState<"none" | "business-api" | "web-js">("none");
  const [waBizPhoneId, setWaBizPhoneId] = useState("");
  const [waBizAccessToken, setWaBizAccessToken] = useState("");
  const [waBizVerifyToken, setWaBizVerifyToken] = useState("");
  const [waAutoReply, setWaAutoReply] = useState(false);
  const [waReplyPrompt, setWaReplyPrompt] = useState("");
  const [waTokenVisible, setWaTokenVisible] = useState(false);
  const [waSaving, setWaSaving] = useState(false);

  const { data: waConfig } = useGetWhatsappConfig({ query: { enabled: !!store } });

  const { data: waStatus } = useGetWhatsappStatus({
    query: {
      enabled: waMode === "web-js",
      refetchInterval: waMode === "web-js" ? 3000 : false,
    },
  });

  const connectWhatsapp = useConnectWhatsapp();
  const disconnectWhatsapp = useDisconnectWhatsapp();
  const updateWaConfig = useUpdateWhatsappConfig();

  useEffect(() => {
    if (waConfig) {
      setWaMode((waConfig.waMode as "none" | "business-api" | "web-js") ?? "none");
      setWaBizPhoneId(waConfig.waBizPhoneId ?? "");
      setWaBizAccessToken(waConfig.waBizAccessToken ?? "");
      setWaBizVerifyToken(waConfig.waBizVerifyToken ?? "");
      setWaAutoReply(waConfig.waAutoReply ?? false);
      setWaReplyPrompt(waConfig.waReplyPrompt ?? "");
    }
  }, [waConfig]);

  const handleWaSave = async () => {
    setWaSaving(true);
    try {
      await updateWaConfig.mutateAsync({
        data: { waMode, waBizPhoneId, waBizAccessToken, waBizVerifyToken, waAutoReply, waReplyPrompt },
      });
      toast.success("WhatsApp settings saved");
    } catch {
      toast.error("Failed to save WhatsApp settings");
    } finally {
      setWaSaving(false);
    }
  };

  // --- Store Badges ---
  const STORE_BADGES = [
    {
      id: "verified",
      label: "Verified WhatsApp Store",
      tagline: "Trusted & official",
      iconPaths: [
        "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
        "M9 12l2 2 4-4",
      ],
    },
    {
      id: "whatsapp",
      label: "Order on WhatsApp",
      tagline: "Chat with us to order",
      iconPaths: [
        "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
      ],
    },
    {
      id: "secure",
      label: "Secure Checkout",
      tagline: "Your data is safe with us",
      iconPaths: [
        "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z",
        "M7 11V7a5 5 0 0 1 10 0v4",
      ],
    },
    {
      id: "delivery",
      label: "Fast Delivery",
      tagline: "Quick & reliable shipping",
      iconPaths: [
        "M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v3M13 9h4l3 3v3h-7V9z",
        "M1.5 17.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0",
        "M16.5 17.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0",
      ],
    },
    {
      id: "authentic",
      label: "100% Authentic",
      tagline: "Genuine products guaranteed",
      iconPaths: [
        "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
        "M9 12l2 2 4-4",
      ],
    },
  ] as const;

  type BadgeId = typeof STORE_BADGES[number]["id"];
  type BadgeTheme = "green" | "white" | "dark";

  const [selectedBadgeId, setSelectedBadgeId] = useState<BadgeId>("verified");
  const [badgeTheme, setBadgeTheme] = useState<BadgeTheme>("green");
  const [badgeCopied, setBadgeCopied] = useState(false);

  const selectedBadge = STORE_BADGES.find((b) => b.id === selectedBadgeId)!;

  function xmlEsc(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function makeBadgeSvg(badge: typeof STORE_BADGES[number], theme: BadgeTheme, storeName: string): string {
    const W = 240, H = 60;
    const bg = theme === "green" ? "#25D366" : theme === "dark" ? "#111827" : "#ffffff";
    const textPrimary = theme === "white" ? "#111827" : "#ffffff";
    const textSecondary = theme === "white" ? "#6b7280" : "rgba(255,255,255,0.72)";
    const iconStroke = theme === "white" ? "#25D366" : "#ffffff";
    const border = theme === "white"
      ? `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="9" fill="none" stroke="#25D366" stroke-width="1.5"/>`
      : "";
    const sc = 22 / 24;
    const iy = (H - 22) / 2;
    const paths = badge.iconPaths
      .map((d) => `<path d="${d}" fill="none" stroke="${iconStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="10" fill="${bg}"/>${border}<g transform="translate(13,${iy}) scale(${sc})">${paths}</g><text x="48" y="${H / 2 - 3}" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="${textPrimary}">${xmlEsc(badge.label)}</text><text x="48" y="${H / 2 + 13}" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="${textSecondary}">${xmlEsc(badge.tagline)} · ${xmlEsc(storeName)}</text></svg>`;
  }

  function makeBadgeHtml(badge: typeof STORE_BADGES[number], theme: BadgeTheme, storeName: string, storeUrl: string): string {
    const svg = makeBadgeSvg(badge, theme, storeName);
    const bytes = new TextEncoder().encode(svg);
    const b64 = btoa(Array.from(bytes).map((b) => String.fromCharCode(b)).join(""));
    return `<a href="${storeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">\n  <img src="data:image/svg+xml;base64,${b64}" alt="${badge.label}" width="240" height="60" style="display:block;border-radius:10px;"/>\n</a>`;
  }

  function downloadBadgePng(badge: typeof STORE_BADGES[number], theme: BadgeTheme, storeName: string) {
    const svg = makeBadgeSvg(badge, theme, storeName);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 480; canvas.height = 120;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 480, 120);
      canvas.toBlob((b) => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `${badge.id}-badge.png`;
        a.click();
      });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  const handleCopyBadgeHtml = () => {
    const storeUrl = store
      ? `${window.location.origin}${basePath}/s/${store.slug}`
      : window.location.origin;
    const html = makeBadgeHtml(selectedBadge, badgeTheme, store?.name ?? "My Store", storeUrl);
    navigator.clipboard.writeText(html);
    setBadgeCopied(true);
    setTimeout(() => setBadgeCopied(false), 2000);
  };

  // --- QR Code ---
  const [qrTarget, setQrTarget] = useState<"store" | "whatsapp">("store");
  const [qrScheme, setQrScheme] = useState<"green" | "black" | "dark">("green");
  const [qrWithLogo, setQrWithLogo] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);

  const qrUrl = store
    ? qrTarget === "store"
      ? `${window.location.origin}${basePath}/s/${store.slug}`
      : `https://wa.me/${(store.whatsappNumber ?? "").replace(/\D/g, "")}?text=${encodeURIComponent("Hi, I'd like to order from your store!")}`
    : "";

  useEffect(() => {
    if (!store || !qrUrl) return;
    let cancelled = false;
    setQrGenerating(true);

    const dark = qrScheme === "green" ? "#25D366" : qrScheme === "dark" ? "#e5e7eb" : "#111827";
    const light = qrScheme === "dark" ? "#111827" : "#ffffff";

    async function generate() {
      try {
        const baseUrl = await QRCode.toDataURL(qrUrl, {
          width: 600,
          margin: 2,
          errorCorrectionLevel: "H",
          color: { dark, light },
        });

        if (cancelled) return;

        const logoSrc = qrWithLogo && store?.logoUrl ? store.logoUrl : null;
        if (!logoSrc) {
          if (!cancelled) { setQrDataUrl(baseUrl); setQrGenerating(false); }
          return;
        }

        const qrImg = new Image();
        qrImg.onerror = () => { if (!cancelled) { setQrDataUrl(baseUrl); setQrGenerating(false); } };
        qrImg.onload = () => {
          if (cancelled) return;
          const sz = 600;
          const canvas = document.createElement("canvas");
          canvas.width = sz; canvas.height = sz;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(qrImg, 0, 0, sz, sz);

          const logoSize = sz / 5;
          const cx = sz / 2, cy = sz / 2;

          ctx.fillStyle = light;
          ctx.beginPath();
          ctx.arc(cx, cy, logoSize / 2 + 8, 0, Math.PI * 2);
          ctx.fill();

          const logoImg = new Image();
          logoImg.crossOrigin = "anonymous";
          logoImg.onerror = () => { if (!cancelled) { setQrDataUrl(canvas.toDataURL("image/png")); setQrGenerating(false); } };
          logoImg.onload = () => {
            if (cancelled) return;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, logoSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(logoImg, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);
            ctx.restore();
            if (!cancelled) { setQrDataUrl(canvas.toDataURL("image/png")); setQrGenerating(false); }
          };
          logoImg.src = logoSrc;
        };
        qrImg.src = baseUrl;
      } catch {
        if (!cancelled) setQrGenerating(false);
      }
    }

    generate();
    return () => { cancelled = true; };
  }, [store, qrUrl, qrScheme, qrWithLogo]);

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${store?.slug ?? "store"}-qr-code.png`;
    a.click();
  };

  const handleCopyQrUrl = () => {
    navigator.clipboard.writeText(qrUrl);
    toast.success("URL copied to clipboard!");
  };

  // --- Store Hours ---
  type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
  type DayHoursState = { enabled: boolean; open: string; close: string };
  type HoursState = Record<DayKey, DayHoursState>;

  const DAYS_OF_WEEK: { key: DayKey; label: string }[] = [
    { key: "monday",    label: "Monday"    },
    { key: "tuesday",   label: "Tuesday"   },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday",  label: "Thursday"  },
    { key: "friday",    label: "Friday"    },
    { key: "saturday",  label: "Saturday"  },
    { key: "sunday",    label: "Sunday"    },
  ];

  const defaultHours = (): HoursState => ({
    monday:    { enabled: true,  open: "09:00", close: "18:00" },
    tuesday:   { enabled: true,  open: "09:00", close: "18:00" },
    wednesday: { enabled: true,  open: "09:00", close: "18:00" },
    thursday:  { enabled: true,  open: "09:00", close: "18:00" },
    friday:    { enabled: true,  open: "09:00", close: "18:00" },
    saturday:  { enabled: false, open: "09:00", close: "15:00" },
    sunday:    { enabled: false, open: "09:00", close: "15:00" },
  });

  const [hours, setHours] = useState<HoursState>(defaultHours());
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursInitialized, setHoursInitialized] = useState(false);

  useEffect(() => {
    if (store && !hoursInitialized) {
      if (store.storeHours) setHours(store.storeHours as HoursState);
      setHoursInitialized(true);
    }
  }, [store, hoursInitialized]);

  const updateDay = (day: DayKey, patch: Partial<DayHoursState>) =>
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const handleSaveHours = async () => {
    setHoursSaving(true);
    try {
      const r = await fetch(`${basePath}/api/stores/me/hours`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hours),
      });
      if (!r.ok) { toast.error((await r.json()).error ?? "Failed to save hours"); }
      else {
        toast.success("Store hours saved!");
        queryClient.invalidateQueries({ queryKey: getGetMyStoreQueryKey() });
      }
    } catch { toast.error("Failed to save hours"); }
    finally { setHoursSaving(false); }
  };

  // --- Holiday Closures ---
  const [holidays, setHolidays] = useState<string[]>([]);
  const [holidayInput, setHolidayInput] = useState("");
  const [holidaysSaving, setHolidaysSaving] = useState(false);
  const [holidaysInitialized, setHolidaysInitialized] = useState(false);

  useEffect(() => {
    if (store && !holidaysInitialized) {
      if (store.holidayClosures) setHolidays(store.holidayClosures as string[]);
      setHolidaysInitialized(true);
    }
  }, [store, holidaysInitialized]);

  const todayISO = new Date().toISOString().slice(0, 10);

  const addHoliday = () => {
    if (!holidayInput) return;
    if (!holidays.includes(holidayInput)) {
      setHolidays((prev) => [...prev, holidayInput].sort());
    }
    setHolidayInput("");
  };

  const removeHoliday = (date: string) =>
    setHolidays((prev) => prev.filter((d) => d !== date));

  const handleSaveHolidays = async () => {
    setHolidaysSaving(true);
    try {
      const r = await fetch(`${basePath}/api/stores/me/holidays`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: holidays }),
      });
      if (!r.ok) { toast.error((await r.json()).error ?? "Failed to save closures"); }
      else {
        toast.success("Holiday closures saved!");
        queryClient.invalidateQueries({ queryKey: getGetMyStoreQueryKey() });
      }
    } catch { toast.error("Failed to save closures"); }
    finally { setHolidaysSaving(false); }
  };

  // --- Temporarily Closed ---
  const [tempClosed, setTempClosed] = useState(false);
  const [tempMessage, setTempMessage] = useState("");
  const [tempClosedSaving, setTempClosedSaving] = useState(false);
  const [tempClosedInitialized, setTempClosedInitialized] = useState(false);

  useEffect(() => {
    if (store && !tempClosedInitialized) {
      setTempClosed(!!store.temporarilyClosed);
      setTempMessage((store.temporaryClosedMessage as string | null) ?? "");
      setTempClosedInitialized(true);
    }
  }, [store, tempClosedInitialized]);

  const handleSaveTempClosed = async (closed: boolean, msg: string) => {
    setTempClosedSaving(true);
    try {
      const r = await fetch(`${basePath}/api/stores/me/temporarily-closed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed, message: msg.trim() || null }),
      });
      if (!r.ok) { toast.error((await r.json()).error ?? "Failed to update status"); }
      else {
        toast.success(closed ? "Store marked as temporarily closed." : "Store is now open!");
        queryClient.invalidateQueries({ queryKey: getGetMyStoreQueryKey() });
      }
    } catch { toast.error("Failed to update status"); }
    finally { setTempClosedSaving(false); }
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

        {/* Store Badges card */}
        {store && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Store Badges
              </CardTitle>
              <CardDescription>
                Generate embeddable trust badges for your website, bio links, or email signature — no account required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Badge type selector */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Badge type</p>
                <div className="flex flex-wrap gap-2">
                  {STORE_BADGES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBadgeId(b.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                        selectedBadgeId === b.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme selector */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Colour theme</p>
                <div className="flex gap-2">
                  {(["green", "white", "dark"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBadgeTheme(t)}
                      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors capitalize ${
                        badgeTheme === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        t === "green" ? "bg-[#25D366]" : t === "dark" ? "bg-gray-900 border border-gray-600" : "bg-white border border-gray-300"
                      }`} />
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live SVG preview */}
              <div className={`rounded-xl p-6 flex items-center justify-center ${badgeTheme === "dark" ? "bg-gray-950" : badgeTheme === "green" ? "bg-gray-100" : "bg-gray-100"}`}>
                <div
                  style={{ display: "inline-block" }}
                  dangerouslySetInnerHTML={{
                    __html: makeBadgeSvg(selectedBadge, badgeTheme, store.name),
                  }}
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleCopyBadgeHtml}
                >
                  {badgeCopied
                    ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Copied!</>
                    : <><Copy className="w-3.5 h-3.5" /> Copy HTML Snippet</>}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => downloadBadgePng(selectedBadge, badgeTheme, store.name)}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PNG
                </Button>
              </div>

              {/* Usage hint */}
              <p className="text-xs text-muted-foreground">
                <strong>HTML snippet</strong> works on any website or Linktree-style page. <strong>PNG</strong> works in email signatures, Instagram bios, and print. The badge links back to your store.
              </p>

            </CardContent>
          </Card>
        )}

        {/* QR Code card */}
        {store && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary" />
                Store QR Code
              </CardTitle>
              <CardDescription>
                Generate a branded QR code customers can scan to open your store page or start a WhatsApp chat instantly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* What the QR links to */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Links to</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: "store", label: "Store page" },
                    { id: "whatsapp", label: "WhatsApp chat" },
                  ] as const).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setQrTarget(id)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                        qrTarget === id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {qrTarget === "whatsapp" && !store.whatsappNumber && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    No WhatsApp number saved — add one in the store settings below.
                  </p>
                )}
              </div>

              {/* Colour scheme */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Colour</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: "green", label: "Green", dotClass: "bg-[#25D366]" },
                    { id: "black", label: "Black", dotClass: "bg-black dark:bg-white" },
                    { id: "dark",  label: "Dark",  dotClass: "bg-gray-800 border border-gray-600" },
                  ] as const).map(({ id, label, dotClass }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setQrScheme(id)}
                      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                        qrScheme === id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logo toggle */}
              {store.logoUrl && (
                <div className="flex items-center gap-3">
                  <Switch
                    checked={qrWithLogo}
                    onCheckedChange={setQrWithLogo}
                    id="qr-logo-toggle"
                  />
                  <label htmlFor="qr-logo-toggle" className="text-sm cursor-pointer select-none">
                    Embed store logo in centre
                  </label>
                </div>
              )}

              {/* Live QR preview */}
              <div className={`rounded-xl p-8 flex flex-col items-center gap-4 transition-colors ${qrScheme === "dark" ? "bg-gray-950" : "bg-gray-100"}`}>
                {qrGenerating || !qrDataUrl ? (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <RefreshCw className="w-7 h-7 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${store.name}`}
                    className="w-48 h-48 rounded-xl shadow-sm"
                  />
                )}
                <p className={`text-[10px] text-center font-mono max-w-xs break-all leading-relaxed ${qrScheme === "dark" ? "text-gray-400" : "text-muted-foreground"}`}>
                  {qrUrl}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  disabled={!qrDataUrl || qrGenerating}
                  onClick={handleDownloadQr}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PNG
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleCopyQrUrl}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy URL
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Print this QR code on packaging, receipts, business cards, or display it in your shop window so customers can scan and order instantly.
              </p>

            </CardContent>
          </Card>
        )}

        {/* Store Hours card */}
        {store && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Store Hours
              </CardTitle>
              <CardDescription>
                Set your opening hours so customers know when you're available. A live Open/Closed indicator will appear on your storefront.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="space-y-1">
                {DAYS_OF_WEEK.map(({ key, label }) => {
                  const day = hours[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${day.enabled ? "bg-muted/40" : ""}`}
                    >
                      <Switch
                        checked={day.enabled}
                        onCheckedChange={(v) => updateDay(key, { enabled: v })}
                        id={`hours-${key}`}
                      />
                      <label
                        htmlFor={`hours-${key}`}
                        className={`w-24 text-sm font-medium cursor-pointer select-none shrink-0 ${day.enabled ? "" : "text-muted-foreground"}`}
                      >
                        {label}
                      </label>

                      {day.enabled ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="time"
                            value={day.open}
                            onChange={(e) => updateDay(key, { open: e.target.value })}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <span className="text-muted-foreground text-xs">to</span>
                          <input
                            type="time"
                            value={day.close}
                            onChange={(e) => updateDay(key, { close: e.target.value })}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                size="sm"
                className="gap-2"
                disabled={hoursSaving}
                onClick={handleSaveHours}
              >
                {hoursSaving
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <Save className="w-3.5 h-3.5" />}
                {hoursSaving ? "Saving…" : "Save Hours"}
              </Button>

            </CardContent>
          </Card>
        )}

        {/* Holiday Closures card */}
        {store && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                Holiday Closures
              </CardTitle>
              <CardDescription>
                Mark specific dates — like public holidays or vacation days — when your store is closed. These override your regular hours and show "Holiday · Closed" on your storefront.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Date picker row */}
              <div className="flex gap-2 flex-wrap">
                <input
                  type="date"
                  value={holidayInput}
                  min={todayISO}
                  onChange={(e) => setHolidayInput(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addHoliday}
                  disabled={!holidayInput}
                >
                  Add Date
                </Button>
              </div>

              {/* List of upcoming holidays */}
              {holidays.filter((d) => d >= todayISO).length > 0 ? (
                <div className="space-y-1">
                  {holidays
                    .filter((d) => d >= todayISO)
                    .sort()
                    .map((date) => (
                      <div
                        key={date}
                        className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                      >
                        <span className="text-sm font-medium">
                          {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                            weekday: "short",
                            month:   "short",
                            day:     "numeric",
                            year:    "numeric",
                          })}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeHoliday(date)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No upcoming holiday closures set.</p>
              )}

              <Button
                type="button"
                size="sm"
                className="gap-2"
                disabled={holidaysSaving}
                onClick={handleSaveHolidays}
              >
                {holidaysSaving
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <Save className="w-3.5 h-3.5" />}
                {holidaysSaving ? "Saving…" : "Save Closures"}
              </Button>

            </CardContent>
          </Card>
        )}

        {/* Temporarily Closed card */}
        {store && (
          <Card className={tempClosed ? "border-amber-400 dark:border-amber-600" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${tempClosed ? "text-amber-500" : "text-muted-foreground"}`} />
                Temporarily Closed
              </CardTitle>
              <CardDescription>
                Instantly pause your store for a lunch break, maintenance, or vacation. Customers will see a notice and the Open/Closed badge will reflect your message.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="flex items-center gap-3">
                <Switch
                  checked={tempClosed}
                  onCheckedChange={(v) => setTempClosed(v)}
                  id="temp-closed-toggle"
                />
                <label
                  htmlFor="temp-closed-toggle"
                  className={`text-sm font-medium cursor-pointer ${
                    tempClosed ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                  }`}
                >
                  {tempClosed ? "Store is temporarily closed" : "Store is open (normal schedule)"}
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Message for customers{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  value={tempMessage}
                  onChange={(e) => setTempMessage(e.target.value)}
                  placeholder="e.g. Back on Monday at 9 AM"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  Shown in the Open/Closed badge and as a banner on your storefront.
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                className={`gap-2 ${tempClosed ? "bg-amber-500 hover:bg-amber-600 text-white border-0" : ""}`}
                variant={tempClosed ? "default" : "outline"}
                disabled={tempClosedSaving}
                onClick={() => handleSaveTempClosed(tempClosed, tempMessage)}
              >
                {tempClosedSaving
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <AlertTriangle className="w-3.5 h-3.5" />}
                {tempClosedSaving
                  ? "Saving…"
                  : tempClosed
                    ? "Mark as Temporarily Closed"
                    : "Save (Store is Open)"}
              </Button>

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
                {store?.notificationEmail && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 w-fit"
                    onClick={sendTestEmail}
                    disabled={testEmailSending}
                  >
                    {testEmailSent ? (
                      <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Test email sent!</>
                    ) : testEmailSending ? (
                      <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                    ) : (
                      <><SendHorizonal className="h-3.5 w-3.5" /> Send test email</>
                    )}
                  </Button>
                )}
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

                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 w-fit"
                  disabled={digestFetching}
                  onClick={async () => {
                    await refetchDigest();
                    setDigestPreviewOpen(true);
                  }}
                >
                  <Eye className="w-4 h-4" />
                  {digestFetching ? "Loading…" : "Preview digest email"}
                </Button>
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

        {/* ── WhatsApp Auto-Reply ───────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-[#25D366]" />
                  WhatsApp Auto-Reply
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 uppercase tracking-wide">Beta</span>
                </CardTitle>
                <CardDescription className="mt-1">
                  AI-powered replies to incoming customer WhatsApp messages. Choose the integration mode that suits your business.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Mode selector */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Integration Mode</p>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { value: "none", label: "Disabled", Icon: XCircle, desc: "No auto-reply" },
                    { value: "business-api", label: "Business API", Icon: Zap, desc: "Official Meta API" },
                    { value: "web-js", label: "WhatsApp Web", Icon: Smartphone, desc: "Scan QR to link" },
                  ] as const
                ).map(({ value, label, Icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWaMode(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 text-center transition-all cursor-pointer ${waMode === value ? "border-[#25D366] bg-[#25D366]/5" : "border-muted hover:border-[#25D366]/40"}`}
                  >
                    <Icon className={`w-5 h-5 ${waMode === value ? "text-[#25D366]" : "text-muted-foreground"}`} />
                    <p className={`text-sm font-semibold ${waMode === value ? "text-[#25D366]" : "text-foreground"}`}>{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                <strong>Business API</strong> is the official Meta integration — ideal for high volume and verified businesses.{" "}
                <strong>WhatsApp Web</strong> links your existing personal/business number via QR scan — no Meta approval needed.
              </p>
            </div>

            {/* Business API config */}
            {waMode === "business-api" && (
              <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Zap className="w-4 h-4 text-[#25D366]" />
                  Meta WhatsApp Business API
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Phone Number ID</label>
                    <Input
                      value={waBizPhoneId}
                      onChange={e => setWaBizPhoneId(e.target.value)}
                      placeholder="1234567890123456"
                    />
                    <p className="text-xs text-muted-foreground">Found in Meta for Developers → Your App → WhatsApp → API Setup</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Permanent Access Token</label>
                    <div className="relative">
                      <Input
                        type={waTokenVisible ? "text" : "password"}
                        value={waBizAccessToken}
                        onChange={e => setWaBizAccessToken(e.target.value)}
                        placeholder="EAAxxxxx..."
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setWaTokenVisible(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {waTokenVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Use a System User token for long-lived access — not a temporary token</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Webhook Verify Token</label>
                    <div className="flex gap-2">
                      <Input
                        value={waBizVerifyToken}
                        onChange={e => setWaBizVerifyToken(e.target.value)}
                        placeholder="my-secret-token-123"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setWaBizVerifyToken(`zapp-${Math.random().toString(36).slice(2, 10)}`)}
                      >
                        Generate
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">A secret string you choose — paste this exact value in Meta's webhook config</p>
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t">
                  <p className="text-xs font-medium text-foreground">Your Webhook URL (paste into Meta)</p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 text-xs bg-background border rounded-lg px-3 py-2 overflow-x-auto text-muted-foreground select-all">
                      {window.location.origin}{basePath}/api/whatsapp/webhook
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}${basePath}/api/whatsapp/webhook`);
                        toast.success("Webhook URL copied!");
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs space-y-1 text-blue-800">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Setup Steps
                  </p>
                  <ol className="space-y-0.5 ml-4 list-decimal">
                    <li>Go to <strong>Meta for Developers → Your App → WhatsApp → Configuration</strong></li>
                    <li>Paste the Webhook URL above and enter your Verify Token</li>
                    <li>Subscribe to the <strong>messages</strong> webhook field</li>
                    <li>Fill in Phone Number ID and Access Token above, then save</li>
                  </ol>
                </div>
              </div>
            )}

            {/* WhatsApp Web (web-js) config */}
            {waMode === "web-js" && (
              <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Smartphone className="w-4 h-4 text-[#25D366]" />
                  WhatsApp Web (Unofficial)
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Unofficial Integration — Use at Your Own Risk</p>
                    <p className="mt-0.5">This links your regular WhatsApp account (no Meta approval needed). It may violate WhatsApp's Terms of Service and could result in account restrictions. Best for testing or markets where the Business API isn't available.</p>
                  </div>
                </div>

                {/* Connection status row */}
                <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      waStatus?.status === "connected"
                        ? "bg-[#25D366] shadow-[0_0_6px_#25D366]"
                        : waStatus?.status === "qr_pending" || waStatus?.status === "connecting"
                        ? "bg-amber-400 animate-pulse"
                        : "bg-muted-foreground/30"
                    }`} />
                    <div>
                      <p className="text-sm font-medium">
                        {waStatus?.status === "connected"
                          ? "Connected"
                          : waStatus?.status === "qr_pending"
                          ? "Waiting for QR scan…"
                          : waStatus?.status === "connecting"
                          ? "Connecting…"
                          : "Disconnected"}
                      </p>
                      {waStatus?.status === "connected" && waStatus.phone && (
                        <p className="text-xs text-muted-foreground">+{waStatus.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {waStatus?.status !== "connected" && (
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5 bg-[#25D366] hover:bg-[#128C7E] text-white"
                        disabled={connectWhatsapp.isPending}
                        onClick={() =>
                          connectWhatsapp.mutate(
                            {},
                            { onError: () => toast.error("Failed to start connection — save settings first") }
                          )
                        }
                      >
                        <ScanLine className="w-4 h-4" />
                        {waStatus?.status === "connecting" || waStatus?.status === "qr_pending"
                          ? "Reconnect"
                          : "Connect & Show QR"}
                      </Button>
                    )}
                    {waStatus?.status === "connected" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="gap-1.5"
                        disabled={disconnectWhatsapp.isPending}
                        onClick={() =>
                          disconnectWhatsapp.mutate(
                            {},
                            { onSuccess: () => toast.success("WhatsApp disconnected") }
                          )
                        }
                      >
                        <WifiOff className="w-4 h-4" /> Disconnect
                      </Button>
                    )}
                  </div>
                </div>

                {/* QR code display */}
                {waStatus?.qrCode && waStatus.status === "qr_pending" && (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <p className="text-xs text-muted-foreground text-center">
                      Open WhatsApp on your phone → <strong>Linked Devices</strong> → <strong>Link a Device</strong> → scan this code
                    </p>
                    <div className="rounded-2xl border-2 border-[#25D366]/40 p-3 bg-white shadow-sm">
                      <img src={waStatus.qrCode} alt="WhatsApp QR Code" className="w-56 h-56 object-contain" />
                    </div>
                    <p className="text-[11px] text-muted-foreground animate-pulse">Refreshing automatically every 3 seconds…</p>
                  </div>
                )}

                {waStatus?.status === "connected" && (
                  <div className="rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 px-4 py-3 flex items-center gap-3 text-sm text-[#128C7E]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <p>WhatsApp Web is active. Incoming messages will be replied to automatically when auto-reply is enabled below.</p>
                  </div>
                )}
              </div>
            )}

            {/* AI Reply settings — visible when any mode is active */}
            {waMode !== "none" && (
              <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Bot className="w-4 h-4 text-[#25D366]" />
                  AI Reply Settings
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enable Auto-Reply</p>
                    <p className="text-xs text-muted-foreground">AI will respond to incoming customer messages automatically</p>
                  </div>
                  <Switch checked={waAutoReply} onCheckedChange={setWaAutoReply} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Custom AI Prompt <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Textarea
                    value={waReplyPrompt}
                    onChange={e => setWaReplyPrompt(e.target.value)}
                    rows={3}
                    placeholder={`You are a friendly sales assistant for ${store?.name || "our store"}. Reply warmly and concisely. Help customers find products and place orders via WhatsApp.`}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the default prompt. Your full product catalog is always included automatically — no need to list products here.
                  </p>
                </div>

                <div className="rounded-lg bg-muted border px-4 py-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> How replies are generated
                  </p>
                  <p>Each incoming message is answered by the AI provider set in the Admin panel (defaults to the built-in AI). The AI sees your store name, currency, and live product list.</p>
                  <p>Human-like delay of 1.5 – 4 seconds is added before each reply to feel natural.</p>
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={handleWaSave}
              disabled={waSaving}
              className="gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white"
            >
              <Save className="w-4 h-4" />
              {waSaving ? "Saving…" : "Save WhatsApp Settings"}
            </Button>

          </CardContent>
        </Card>
      </div>

      {/* Digest Preview Dialog */}
      <Dialog open={digestPreviewOpen} onOpenChange={setDigestPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              {digestData?.period === "weekly" ? "Weekly" : "Daily"} Digest Preview
            </DialogTitle>
          </DialogHeader>

          {digestData ? (() => {
            const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: digestData.currency || "USD" }).format(n);
            const start = new Date(digestData.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const end = new Date(digestData.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const statusColor: Record<string, string> = {
              pending: "bg-amber-100 text-amber-800",
              confirmed: "bg-blue-100 text-blue-800",
              completed: "bg-green-100 text-green-800",
              cancelled: "bg-red-100 text-red-800",
            };
            return (
              <div className="space-y-6 text-sm">
                {/* Period banner */}
                <div className="rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{digestData.storeName}</p>
                    <p className="text-muted-foreground text-xs">
                      {digestData.period === "weekly" ? "Weekly" : "Daily"} sales digest · {start} – {end}
                    </p>
                  </div>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-card p-4 text-center">
                    <ShoppingCart className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{digestData.orderCount}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Orders</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4 text-center">
                    <TrendingUp className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{fmt(digestData.revenue)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Revenue</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4 text-center">
                    <Package className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{fmt(digestData.avgOrderValue)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Avg order</p>
                  </div>
                </div>

                {/* Top products */}
                {digestData.topProducts.length > 0 && (
                  <div>
                    <p className="font-semibold mb-2 text-foreground">Top Products</p>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 text-muted-foreground text-xs">
                            <th className="text-left px-3 py-2 font-medium">Product</th>
                            <th className="text-right px-3 py-2 font-medium">Units</th>
                            <th className="text-right px-3 py-2 font-medium">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {digestData.topProducts.map((p, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-2 font-medium truncate max-w-[200px]">{p.name}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">{p.unitsSold}</td>
                              <td className="px-3 py-2 text-right font-medium">{fmt(p.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent orders */}
                {digestData.recentOrders.length > 0 && (
                  <div>
                    <p className="font-semibold mb-2 text-foreground">Recent Orders</p>
                    <div className="space-y-2">
                      {digestData.recentOrders.map((o) => (
                        <div key={o.id} className="flex items-center justify-between rounded-lg border px-3 py-2 gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{o.customerName ?? "Guest"}</p>
                            <p className="text-xs text-muted-foreground">
                              Order #{o.id} · {new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[o.status] ?? "bg-muted text-muted-foreground"}`}>
                              {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                            </span>
                            <span className="font-semibold">{fmt(o.total)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {digestData.orderCount === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No orders in this period yet.</p>
                    <p className="text-xs mt-1">The digest will show data once orders come in.</p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground border-t pt-3 text-center">
                  This is a preview of what your {digestData.period === "weekly" ? "weekly" : "daily"} digest email will look like.
                  {store?.notificationEmail ? ` It will be sent to ${store.notificationEmail}.` : " Set a notification email above to receive it."}
                </p>
              </div>
            );
          })() : (
            <div className="text-center py-8 text-muted-foreground">Loading digest data…</div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
