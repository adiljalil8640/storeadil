import { useState, useRef } from "react";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, getListProductsQueryKey, useGenerateProductDescription, useSuggestProductPrice, useGetWaitlistCounts, useImportProducts, useNotifyWaitlist, getGetWaitlistCountsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, MoreVertical, Edit, Trash, PackageOpen, ImageIcon, Sparkles, DollarSign, Bell, Upload, Download, FileText, CheckCircle, AlertCircle, Send } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";

const TEMPLATE_CSV = `name,price,description,category,stock,low_stock_threshold
Red Sneakers,49.99,Comfortable running shoes for all occasions,Footwear,20,5
Blue Denim Jacket,89.99,Classic stonewashed denim jacket,Clothing,10,3
Wireless Earbuds,29.99,Bluetooth 5.0 earbuds with 8h battery,Electronics,50,10`;

const TEMPLATE_FILENAME = "products_template.csv";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = TEMPLATE_FILENAME;
  a.click();
  URL.revokeObjectURL(url);
}

type ParsedRow = {
  name: string; price: string; description: string;
  category: string; stock: string; low_stock_threshold: string;
  _valid: boolean; _error?: string;
};

function parsePreview(csvText: string): ParsedRow[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const parseCell = (s: string) => s.replace(/^["']|["']$/g, "").trim();
  const header = lines[0].split(",").map(h => parseCell(h).toLowerCase().replace(/\s+/g, "_"));
  const col = (row: string[], key: string) => {
    const idx = header.indexOf(key);
    return idx >= 0 ? parseCell(row[idx] ?? "") : "";
  };
  return lines.slice(1).map(line => {
    const row = line.split(",");
    const name = col(row, "name");
    const price = col(row, "price");
    const p = parseFloat(price);
    const valid = !!name && !isNaN(p) && p >= 0;
    return {
      name, price,
      description: col(row, "description"),
      category: col(row, "category"),
      stock: col(row, "stock"),
      low_stock_threshold: col(row, "low_stock_threshold"),
      _valid: valid,
      _error: !name ? "Missing name" : (isNaN(p) || p < 0) ? "Invalid price" : undefined,
    };
  });
}

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importProducts = useImportProducts({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        if (data.imported > 0) onDone();
      },
      onError: (e: any) => toast.error(e?.response?.data?.error ?? "Import failed"),
    },
  });

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      setPreview(parsePreview(text));
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) handleFile(file);
    else toast.error("Please drop a .csv file");
  };

  const reset = () => { setCsvText(""); setPreview([]); setResult(null); };

  const handleClose = () => { reset(); onClose(); };

  const validCount = preview.filter(r => r._valid).length;
  const invalidCount = preview.filter(r => !r._valid).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" /> Import Products from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Template download */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 border px-4 py-3">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Download the CSV template</p>
                <p className="text-xs text-muted-foreground">Columns: name, price, description, category, stock, low_stock_threshold</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={downloadTemplate}>
              <Download className="w-3.5 h-3.5" /> Template
            </Button>
          </div>

          {/* Drop zone */}
          {!csvText && (
            <div
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="font-medium text-sm">Drag & drop your CSV file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-primary font-medium">
                    <CheckCircle className="w-4 h-4" /> {validCount} valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1.5 text-destructive font-medium">
                      <AlertCircle className="w-4 h-4" /> {invalidCount} invalid
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={reset}>Change file</Button>
              </div>
              <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i} className={!row._valid ? "bg-destructive/5" : ""}>
                        <TableCell>
                          {row._valid
                            ? <CheckCircle className="w-4 h-4 text-primary" />
                            : <Tooltip><TooltipTrigger><AlertCircle className="w-4 h-4 text-destructive" /></TooltipTrigger><TooltipContent>{row._error}</TooltipContent></Tooltip>
                          }
                        </TableCell>
                        <TableCell className="font-medium max-w-[180px] truncate">{row.name || <span className="text-muted-foreground italic">—</span>}</TableCell>
                        <TableCell>{row.price}</TableCell>
                        <TableCell>{row.category || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{row.stock || <span className="text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-xl border p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{result.imported} product{result.imported === 1 ? "" : "s"} imported</p>
                  {result.skipped > 0 && <p className="text-sm text-muted-foreground">{result.skipped} row{result.skipped === 1 ? "" : "s"} skipped due to errors</p>}
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-1">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{e}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t mt-2">
          <Button variant="outline" onClick={handleClose}>{result ? "Close" : "Cancel"}</Button>
          {!result && (
            <Button
              disabled={validCount === 0 || importProducts.isPending}
              onClick={() => importProducts.mutate({ data: { csv: csvText } })}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              {importProducts.isPending ? "Importing…" : `Import ${validCount} Product${validCount === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const productSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be positive"),
  category: z.string().optional(),
  stock: z.coerce.number().int().min(0).optional().nullable(),
  lowStockThreshold: z.coerce.number().int().min(0).optional().nullable(),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type ProductFormValues = z.infer<typeof productSchema>;

function AiButtons({ form, nameField, descriptionField, priceField }: { form: any; nameField: string; descriptionField: string; priceField: string }) {
  const generateDesc = useGenerateProductDescription({
    mutation: {
      onSuccess: (data) => {
        form.setValue(descriptionField, data.description, { shouldValidate: true });
        toast.success("AI description generated!");
      },
      onError: () => toast.error("Could not generate description. Check your AI integration."),
    },
  });

  const suggestPrice = useSuggestProductPrice({
    mutation: {
      onSuccess: (data) => {
        form.setValue(priceField, data.suggestedPrice, { shouldValidate: true });
        toast.success(`AI suggested $${data.suggestedPrice} — ${data.reasoning}`);
      },
      onError: () => toast.error("Could not suggest price."),
    },
  });

  const name = form.watch(nameField);
  const category = form.watch("category");

  return (
    <div className="flex gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={!name || generateDesc.isPending}
            onClick={() => generateDesc.mutate({ data: { productName: name, category: category || undefined } })}
          >
            <Sparkles className="w-3 h-3 text-primary" />
            {generateDesc.isPending ? "Generating..." : "AI Description"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Generate a product description using AI</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={!name || suggestPrice.isPending}
            onClick={() => suggestPrice.mutate({ data: { productName: name, category: category || undefined } })}
          >
            <DollarSign className="w-3 h-3 text-primary" />
            {suggestPrice.isPending ? "Thinking..." : "AI Price"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Get an AI-suggested price for this product</TooltipContent>
      </Tooltip>
    </div>
  );
}

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const { data: products, isLoading } = useListProducts({ search: searchTerm || undefined });
  const { data: waitlistData } = useGetWaitlistCounts();
  const waitlistCounts: Record<number, number> = waitlistData?.counts ?? {};

  const createProduct = useCreateProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setIsAddOpen(false);
        form.reset();
        toast.success("Product added successfully");
      },
    },
  });

  const updateProduct = useUpdateProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setEditingProduct(null);
        toast.success("Product updated successfully");
      },
    },
  });

  const deleteProduct = useDeleteProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setDeletingId(null);
        toast.success("Product deleted successfully");
      },
    },
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", price: 0, category: "", stock: null, lowStockThreshold: null, imageUrl: "" },
  });

  const editForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
  });

  const onSubmitAdd = (values: ProductFormValues) => {
    createProduct.mutate({ data: { ...values, isActive: true } });
  };

  const onSubmitEdit = (values: ProductFormValues) => {
    if (!editingProduct) return;
    updateProduct.mutate({ id: editingProduct.id, data: values });
  };

  const handleEditClick = (product: any) => {
    editForm.reset({
      name: product.name,
      description: product.description || "",
      price: product.price,
      category: product.category || "",
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      imageUrl: product.imageUrl || "",
    });
    setEditingProduct(product);
  };

  const notifyWaitlist = useNotifyWaitlist({
    mutation: {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetWaitlistCountsQueryKey() });
        toast.success(`Notified ${data.notified} customer${data.notified === 1 ? "" : "s"}`);
      },
      onError: () => toast.error("Failed to send notifications"),
    },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const ProductForm = ({ formObj, onSubmit, isPending, submitLabel }: { formObj: any; onSubmit: any; isPending: boolean; submitLabel: string }) => (
    <Form {...formObj}>
      <form onSubmit={formObj.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={formObj.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={formObj.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formObj.control}
            name="stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock (Optional)</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={formObj.control}
          name="lowStockThreshold"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Low Stock Alert Threshold</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 5 — leave blank to disable"
                  {...field}
                  value={field.value ?? ""}
                  onChange={e => field.onChange(e.target.value === "" ? null : e.target.valueAsNumber)}
                />
              </FormControl>
              <p className="text-[0.8rem] text-muted-foreground">
                Get an email alert when stock drops to this number or below. Requires notification email to be set.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={formObj.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl><Input placeholder="e.g. Coffee, Equipment" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={formObj.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between mb-1.5">
                <FormLabel className="mb-0">Description</FormLabel>
                <AiButtons form={formObj} nameField="name" descriptionField="description" priceField="price" />
              </div>
              <FormControl><Textarea className="resize-none" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={formObj.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image URL (Optional)</FormLabel>
              <FormControl><Input placeholder="https://..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter className="pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground">Manage your store inventory.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setIsImportOpen(true)}>
              <Upload className="w-4 h-4" />
              Import CSV
            </Button>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Add New Product
                  <Badge variant="outline" className="gap-1 text-primary border-primary/30 text-xs font-normal">
                    <Sparkles className="w-3 h-3" /> AI-powered
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <ProductForm formObj={form} onSubmit={onSubmitAdd} isPending={createProduct.isPending} submitLabel="Add Product" />
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <ImportDialog
          open={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            setIsImportOpen(false);
          }}
        />

        <div className="flex items-center relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading products...</div>
        ) : products?.length === 0 ? (
          <div className="text-center py-20 border border-dashed rounded-xl bg-card">
            <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No products found</h3>
            <p className="text-muted-foreground mb-4">You haven't added any products yet, or none match your search.</p>
            <Button onClick={() => setIsAddOpen(true)}>Add your first product</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products?.map((product) => (
              <motion.div key={product.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="overflow-hidden group hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-muted relative border-b overflow-hidden flex items-center justify-center">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="object-cover w-full h-full" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                    )}
                    {waitlistCounts[product.id] > 0 && (
                      <div className="absolute top-2 left-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm cursor-default">
                              <Bell className="w-3 h-3" />
                              {waitlistCounts[product.id]}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {waitlistCounts[product.id]} customer{waitlistCounts[product.id] === 1 ? "" : "s"} waiting for restock
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="w-8 h-8 rounded-full shadow-sm bg-background/80 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClick(product)}>
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          {waitlistCounts[product.id] > 0 && (
                            <DropdownMenuItem
                              onClick={() => notifyWaitlist.mutate({ id: product.id })}
                              disabled={notifyWaitlist.isPending}
                            >
                              <Send className="w-4 h-4 mr-2 text-amber-600" />
                              <span>Notify {waitlistCounts[product.id]} waiting</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => setDeletingId(product.id)}>
                            <Trash className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-semibold text-lg leading-tight truncate" title={product.name}>{product.name}</h3>
                      <span className="font-bold text-primary">{formatCurrency(product.price)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                      <span>{product.category || "Uncategorized"}</span>
                      {product.stock !== null && product.stock !== undefined ? (
                        <span className={
                          product.lowStockThreshold !== null &&
                          product.lowStockThreshold !== undefined &&
                          product.stock <= product.lowStockThreshold
                            ? "text-destructive font-semibold"
                            : ""
                        }>
                          {product.lowStockThreshold !== null &&
                           product.lowStockThreshold !== undefined &&
                           product.stock <= product.lowStockThreshold
                            ? `⚠ ${product.stock} left`
                            : `${product.stock} in stock`}
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Edit Product
                <Badge variant="outline" className="gap-1 text-primary border-primary/30 text-xs font-normal">
                  <Sparkles className="w-3 h-3" /> AI-powered
                </Badge>
              </DialogTitle>
            </DialogHeader>
            {editingProduct && (
              <ProductForm formObj={editForm} onSubmit={onSubmitEdit} isPending={updateProduct.isPending} submitLabel="Save Changes" />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Alert */}
        <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the product from your store.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingId && deleteProduct.mutate({ id: deletingId })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteProduct.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
