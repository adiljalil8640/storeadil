import { useState } from "react";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, getListProductsQueryKey, useGenerateProductDescription, useSuggestProductPrice } from "@workspace/api-client-react";
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
import { Search, Plus, MoreVertical, Edit, Trash, PackageOpen, ImageIcon, Sparkles, DollarSign } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const { data: products, isLoading } = useListProducts({ search: searchTerm || undefined });

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
