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
import { Store, Save, ExternalLink, Copy, QrCode, Share2, MessageCircle, Download, Bell, Tag } from "lucide-react";
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your store preferences and configuration.</p>
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
