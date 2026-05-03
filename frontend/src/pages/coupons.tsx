import { useState } from "react";
import { useListCoupons, useCreateCoupon, useUpdateCoupon, useDeleteCoupon, getListCouponsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tag, Plus, MoreHorizontal, Trash2, Pencil, Copy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type CouponForm = {
  code: string;
  type: "percentage" | "fixed";
  value: string;
  minOrderAmount: string;
  maxUses: string;
  expiresAt: string;
  isActive: boolean;
};

const emptyForm = (): CouponForm => ({
  code: "",
  type: "percentage",
  value: "",
  minOrderAmount: "",
  maxUses: "",
  expiresAt: "",
  isActive: true,
});

function CouponDialog({
  open,
  onClose,
  initial,
  onSubmit,
  isPending,
  title,
}: {
  open: boolean;
  onClose: () => void;
  initial: CouponForm;
  onSubmit: (f: CouponForm) => void;
  isPending: boolean;
  title: string;
}) {
  const [form, setForm] = useState<CouponForm>(initial);

  const set = (key: keyof CouponForm, val: any) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) return toast.error("Code is required");
    const v = parseFloat(form.value);
    if (isNaN(v) || v <= 0) return toast.error("Value must be a positive number");
    if (form.type === "percentage" && v > 100) return toast.error("Percentage cannot exceed 100");
    onSubmit(form);
  };

  // Reset form when opened
  const handleOpen = () => setForm(initial);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          <div className="space-y-1.5">
            <Label>Code <span className="text-destructive">*</span></Label>
            <Input
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="SAVE20"
              className="font-mono tracking-widest"
              maxLength={32}
            />
            <p className="text-xs text-muted-foreground">Customers enter this at checkout. Auto-uppercased.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select value={form.type} onValueChange={(v: any) => set("type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Value <span className="text-destructive">*</span>
                <span className="text-muted-foreground font-normal ml-1">
                  ({form.type === "percentage" ? "%" : "$"})
                </span>
              </Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                max={form.type === "percentage" ? "100" : undefined}
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder={form.type === "percentage" ? "20" : "5.00"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Min Order Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.minOrderAmount}
                onChange={(e) => set("minOrderAmount", e.target.value)}
                placeholder="0.00 (none)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Uses</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={form.maxUses}
                onChange={(e) => set("maxUses", e.target.value)}
                placeholder="Unlimited"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Expiry Date</Label>
            <Input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Customers can use this coupon</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save Coupon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const { data: coupons = [], isLoading } = useListCoupons();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });

  const createCoupon = useCreateCoupon({
    mutation: {
      onSuccess: () => { invalidate(); setCreateOpen(false); toast.success("Coupon created"); },
      onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to create coupon"),
    },
  });

  const updateCoupon = useUpdateCoupon({
    mutation: {
      onSuccess: () => { invalidate(); setEditTarget(null); toast.success("Coupon updated"); },
      onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to update coupon"),
    },
  });

  const deleteCoupon = useDeleteCoupon({
    mutation: {
      onSuccess: () => { invalidate(); toast.success("Coupon deleted"); },
      onError: () => toast.error("Failed to delete coupon"),
    },
  });

  const formToPayload = (form: CouponForm) => ({
    code: form.code.trim().toUpperCase(),
    type: form.type,
    value: parseFloat(form.value),
    minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : null,
    maxUses: form.maxUses ? parseInt(form.maxUses) : null,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    isActive: form.isActive,
  });

  const couponToForm = (c: any): CouponForm => ({
    code: c.code,
    type: c.type,
    value: String(c.value),
    minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : "",
    maxUses: c.maxUses != null ? String(c.maxUses) : "",
    expiresAt: c.expiresAt ? format(new Date(c.expiresAt), "yyyy-MM-dd'T'HH:mm") : "",
    isActive: c.isActive,
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };

  const isExpired = (c: any) =>
    c.expiresAt && new Date(c.expiresAt) < new Date();
  const isExhausted = (c: any) =>
    c.maxUses !== null && c.usedCount >= c.maxUses;

  const statusBadge = (c: any) => {
    if (!c.isActive) return <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
    if (isExpired(c)) return <Badge variant="outline" className="text-destructive border-destructive/30">Expired</Badge>;
    if (isExhausted(c)) return <Badge variant="outline" className="text-orange-600 border-orange-300">Limit Reached</Badge>;
    return <Badge variant="outline" className="text-primary border-primary/30">Active</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Coupons</h1>
            <p className="text-muted-foreground">Create discount codes your customers can use at checkout.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> New Coupon
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading coupons…</div>
            ) : coupons.length === 0 ? (
              <div className="text-center py-20">
                <Tag className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium mb-1">No coupons yet</h3>
                <p className="text-muted-foreground mb-4">Create your first discount code to boost sales.</p>
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Create Coupon
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <button
                          className="flex items-center gap-2 font-mono font-semibold tracking-widest hover:text-primary transition-colors group"
                          onClick={() => copyCode(c.code)}
                          title="Click to copy"
                        >
                          {c.code}
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </button>
                        {c.minOrderAmount != null && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Min. order ${Number(c.minOrderAmount).toFixed(2)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.type === "percentage"
                          ? `${Number(c.value)}% off`
                          : `$${Number(c.value).toFixed(2)} off`}
                      </TableCell>
                      <TableCell>
                        <span className={isExhausted(c) ? "text-orange-600 font-medium" : ""}>
                          {c.usedCount}{c.maxUses != null ? `/${c.maxUses}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.expiresAt
                          ? <span className={isExpired(c) ? "text-destructive font-medium" : ""}>{format(new Date(c.expiresAt), "MMM d, yyyy")}</span>
                          : "Never"}
                      </TableCell>
                      <TableCell>{statusBadge(c)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyCode(c.code)}>
                              <Copy className="w-4 h-4 mr-2" /> Copy Code
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditTarget(c)}>
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (confirm(`Delete coupon "${c.code}"?`))
                                  deleteCoupon.mutate({ id: c.id });
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <CouponDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initial={emptyForm()}
        onSubmit={(form) => createCoupon.mutate({ data: formToPayload(form) as any })}
        isPending={createCoupon.isPending}
        title="New Coupon"
      />

      {/* Edit Dialog */}
      {editTarget && (
        <CouponDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          initial={couponToForm(editTarget)}
          onSubmit={(form) => updateCoupon.mutate({ id: editTarget.id, data: formToPayload(form) as any })}
          isPending={updateCoupon.isPending}
          title="Edit Coupon"
        />
      )}
    </AppLayout>
  );
}
