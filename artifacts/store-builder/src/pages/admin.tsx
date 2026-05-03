import { useState } from "react";
import {
  useGetAdminStats, useGetAdminUsers, useChangeUserPlan, getGetAdminUsersQueryKey,
  useListAiProviders, useCreateAiProvider, useUpdateAiProvider, useDeleteAiProvider,
  useSetDefaultAiProvider, useTestAiProvider, getListAiProvidersQueryKey,
} from "@workspace/api-client-react";
import type { AiProviderBodyProvider } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Users, Store, ShoppingCart, DollarSign, Shield, ExternalLink,
  Brain, Plus, Pencil, Trash2, Star, StarOff, Zap, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-secondary text-secondary-foreground",
  pro: "bg-primary/10 text-primary",
  business: "bg-violet-100 text-violet-700",
};

const PROVIDER_PRESETS: Record<string, { baseUrl: string; models: string[]; label: string; color: string }> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    color: "bg-emerald-100 text-emerald-700",
  },
  gemini: {
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    color: "bg-blue-100 text-blue-700",
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    color: "bg-orange-100 text-orange-700",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.3-70b-instruct"],
    color: "bg-purple-100 text-purple-700",
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
    color: "bg-cyan-100 text-cyan-700",
  },
  huggingface: {
    label: "Hugging Face",
    baseUrl: "https://api-inference.huggingface.co/v1",
    models: ["meta-llama/Meta-Llama-3-8B-Instruct", "mistralai/Mixtral-8x7B-Instruct-v0.1"],
    color: "bg-yellow-100 text-yellow-700",
  },
  custom: {
    label: "Custom",
    baseUrl: "",
    models: [],
    color: "bg-muted text-muted-foreground",
  },
};

type ProviderForm = {
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  isActive: boolean;
};

const emptyForm = (): ProviderForm => ({
  name: "",
  provider: "openai",
  baseUrl: PROVIDER_PRESETS.openai.baseUrl,
  apiKey: "",
  defaultModel: PROVIDER_PRESETS.openai.models[0],
  isActive: true,
});

export default function AdminPage() {
  const qc = useQueryClient();

  // ── users ──
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: users, isLoading: usersLoading } = useGetAdminUsers({ limit: 100 });
  const changePlan = useChangeUserPlan({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() }); toast.success("Plan updated"); },
      onError: () => toast.error("Failed to update plan"),
    },
  });

  // ── ai providers ──
  const { data: providers = [], isLoading: providersLoading } = useListAiProviders();
  const createProvider = useCreateAiProvider({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAiProvidersQueryKey() }); toast.success("Provider added"); setDialogOpen(false); } } });
  const updateProvider = useUpdateAiProvider({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAiProvidersQueryKey() }); toast.success("Provider updated"); setDialogOpen(false); } } });
  const deleteProvider = useDeleteAiProvider({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAiProvidersQueryKey() }); toast.success("Provider deleted"); } } });
  const setDefault = useSetDefaultAiProvider({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAiProvidersQueryKey() }); toast.success("Default provider updated"); } } });
  const testProvider = useTestAiProvider();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProviderForm>(emptyForm());
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setTestResult(null); setShowKey(false); setDialogOpen(true); };
  const openEdit = (p: typeof providers[0]) => {
    setEditingId(p.id);
    setForm({ name: p.name, provider: p.provider, baseUrl: p.baseUrl, apiKey: p.apiKey, defaultModel: p.defaultModel, isActive: p.isActive });
    setTestResult(null);
    setShowKey(false);
    setDialogOpen(true);
  };

  const handleProviderChange = (val: string) => {
    const preset = PROVIDER_PRESETS[val] ?? PROVIDER_PRESETS.custom;
    setForm(f => ({
      ...f,
      provider: val,
      baseUrl: preset.baseUrl || f.baseUrl,
      defaultModel: preset.models[0] ?? f.defaultModel,
    }));
  };

  const handleSave = () => {
    if (!form.name || !form.baseUrl || !form.apiKey || !form.defaultModel) {
      toast.error("All fields are required");
      return;
    }
    const payload = { ...form, provider: form.provider as AiProviderBodyProvider };
    if (editingId !== null) {
      updateProvider.mutate({ id: editingId, data: payload });
    } else {
      createProvider.mutate({ data: payload });
    }
  };

  const handleTest = async () => {
    if (!form.baseUrl || !form.apiKey || !form.defaultModel) {
      toast.error("Fill in baseUrl, apiKey and model first");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProvider.mutateAsync({ data: { ...form, provider: form.provider as AiProviderBodyProvider } });
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const preset = PROVIDER_PRESETS[form.provider] ?? PROVIDER_PRESETS.custom;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
            <p className="text-muted-foreground text-sm">Platform overview, user management, and AI configuration.</p>
          </div>
        </div>

        {/* Platform Stats */}
        {!statsLoading && stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-600" },
              { label: "Total Stores", value: stats.totalStores, icon: Store, color: "text-primary" },
              { label: "Total Orders", value: stats.totalOrders, icon: ShoppingCart, color: "text-yellow-600" },
              { label: "Total Revenue", value: `$${Number(stats.totalRevenue).toFixed(0)}`, icon: DollarSign, color: "text-green-600" },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpi.value}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Plan Breakdown */}
        {stats?.planBreakdown && (
          <Card>
            <CardHeader><CardTitle>Plan Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-6 flex-wrap">
                {Object.entries(stats.planBreakdown).map(([plan, count]) => (
                  <div key={plan} className="flex items-center gap-2">
                    <Badge className={PLAN_COLORS[plan] ?? ""}>{plan}</Badge>
                    <span className="font-semibold">{count}</span>
                    <span className="text-muted-foreground text-sm">users</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── AI Provider Manager ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              <CardTitle>AI Providers</CardTitle>
            </div>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Provider
            </Button>
          </CardHeader>
          <CardContent>
            {providersLoading ? (
              <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 animate-pulse bg-muted rounded-lg" />)}</div>
            ) : providers.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Brain className="w-10 h-10 mx-auto mb-3 opacity-25" />
                <p className="text-sm font-medium">No AI providers configured</p>
                <p className="text-xs mt-1">Add OpenAI, Gemini, Groq, or any OpenAI-compatible provider.</p>
                <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={openCreate}>
                  <Plus className="w-4 h-4" /> Add your first provider
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {providers.map((p, i) => {
                  const meta = PROVIDER_PRESETS[p.provider] ?? PROVIDER_PRESETS.custom;
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${p.isDefault ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
                    >
                      {/* Provider badge */}
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${meta.color}`}>
                        {meta.label}
                      </span>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{p.name}</span>
                          {p.isDefault && <Badge className="bg-primary/10 text-primary text-[10px] py-0 px-1.5">Default</Badge>}
                          {!p.isActive && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Inactive</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {p.defaultModel} · <span className="font-mono">{p.baseUrl}</span>
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!p.isDefault && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-amber-500"
                            title="Set as default"
                            onClick={() => setDefault.mutate({ id: p.id })}
                          >
                            <StarOff className="w-4 h-4" />
                          </Button>
                        )}
                        {p.isDefault && <Star className="w-4 h-4 text-amber-500 mx-2" />}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteProvider.mutate({ id: p.id }); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 animate-pulse bg-muted rounded" />)}</div>
            ) : !users?.length ? (
              <div className="text-center py-8 text-muted-foreground">No users yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 pr-4 font-medium">User ID</th>
                      <th className="text-left py-2 pr-4 font-medium">Store</th>
                      <th className="text-left py-2 pr-4 font-medium">Plan</th>
                      <th className="text-right py-2 pr-4 font-medium">Orders (month)</th>
                      <th className="text-right py-2 pr-4 font-medium">Total Orders</th>
                      <th className="text-left py-2 font-medium">Change Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, idx) => (
                      <motion.tr
                        key={user.userId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        className="border-b last:border-0"
                      >
                        <td className="py-3 pr-4">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{user.userId.slice(0, 16)}…</code>
                        </td>
                        <td className="py-3 pr-4">
                          {user.storeSlug ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{user.storeName ?? user.storeSlug}</span>
                              <a href={`/store/${user.storeSlug}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                              </a>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={`text-xs ${PLAN_COLORS[user.planName] ?? ""}`}>{user.planDisplayName}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-right">{user.ordersThisMonth}</td>
                        <td className="py-3 pr-4 text-right">{user.totalOrders}</td>
                        <td className="py-3">
                          <Select
                            defaultValue={user.planName}
                            onValueChange={(val) => changePlan.mutate({ userId: user.userId, data: { planName: val as "free" | "pro" | "business" } })}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                              <SelectItem value="business">Business</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Add / Edit Provider Dialog ────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              {editingId !== null ? "Edit AI Provider" : "Add AI Provider"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Provider type */}
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={handleProviderChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_PRESETS).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Display name */}
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                placeholder={`e.g. ${preset.label} Production`}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Base URL */}
            <div className="space-y-1.5">
              <Label>Base URL</Label>
              <Input
                placeholder="https://api.openai.com/v1"
                value={form.baseUrl}
                onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder="sk-…"
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <Label>Default Model</Label>
              {preset.models.length > 0 ? (
                <Select value={form.defaultModel} onValueChange={val => setForm(f => ({ ...f, defaultModel: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {preset.models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    <SelectItem value="__custom__">Custom…</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              {(preset.models.length === 0 || form.defaultModel === "__custom__") && (
                <Input
                  placeholder="e.g. gpt-4o-mini"
                  value={form.defaultModel === "__custom__" ? "" : form.defaultModel}
                  onChange={e => setForm(f => ({ ...f, defaultModel: e.target.value }))}
                  className="font-mono text-sm"
                />
              )}
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive providers won't be used for AI requests</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
            </div>

            {/* Test connection */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-1.5">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {testing ? "Testing…" : "Test Connection"}
              </Button>
              {testResult && (
                <span className={`flex items-center gap-1.5 text-sm ${testResult.success ? "text-emerald-600" : "text-destructive"}`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {testResult.message}
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createProvider.isPending || updateProvider.isPending}>
              {createProvider.isPending || updateProvider.isPending ? "Saving…" : editingId !== null ? "Save Changes" : "Add Provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
