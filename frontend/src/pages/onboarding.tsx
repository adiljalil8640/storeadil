import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useClerk } from "@clerk/react";
import { useGenerateStore, useCreateStore, useGetMyStore, useApplyReferralCode } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Store, Sparkles, CheckCircle2, Loader2, ArrowRight, Gift, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const describeSchema = z.object({
  description: z.string().min(10, "Please provide a brief description of what you sell."),
});

const detailsSchema = z.object({
  name: z.string().min(2, "Store name is required"),
  whatsappNumber: z.string().min(5, "WhatsApp number is required"),
});

export default function OnboardingPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [, setLocation] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  // Capture referral code from URL (?ref=CODE)
  const refCode = new URLSearchParams(window.location.search).get("ref")?.toUpperCase() ?? null;
  
  const { data: existingStore, isLoading: checkingStore } = useGetMyStore({
    query: { retry: false }
  });

  useEffect(() => {
    if (existingStore && !checkingStore) {
      setLocation(`${basePath}/dashboard`);
    }
  }, [existingStore, checkingStore, setLocation, basePath]);

  const generateStore = useGenerateStore();
  const createStore = useCreateStore();
  const applyReferral = useApplyReferralCode();

  const describeForm = useForm<z.infer<typeof describeSchema>>({
    resolver: zodResolver(describeSchema),
    defaultValues: { description: "" },
  });

  const detailsForm = useForm<z.infer<typeof detailsSchema>>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: "", whatsappNumber: "" },
  });

  const onDescribeSubmit = async (values: z.infer<typeof describeSchema>) => {
    try {
      const generated = await generateStore.mutateAsync({ data: values });
      detailsForm.setValue("name", generated.name);
      setStep(2);
    } catch (error) {
      toast.error("Failed to generate store ideas. Let's set it up manually.");
      setStep(2);
    }
  };

  const onDetailsSubmit = async (values: z.infer<typeof detailsSchema>) => {
    try {
      const slug = values.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      await createStore.mutateAsync({ 
        data: { 
          name: values.name, 
          slug, 
          whatsappNumber: values.whatsappNumber,
          description: describeForm.getValues("description")
        } 
      });
      // Apply referral code silently if one was in the URL
      if (refCode) {
        applyReferral.mutate({ data: { code: refCode } });
      }
      setStep(3);
    } catch (error) {
      toast.error("Failed to create store. Please try again.");
    }
  };

  const { signOut } = useClerk();

  if (checkingStore) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-lg">

        {/* Sign-out escape hatch */}
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
            onClick={() => signOut({ redirectUrl: "/" })}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
        
        {/* Progress bar */}
        <div className="mb-8 flex justify-center items-center gap-2">
          <div className={`h-2 rounded-full flex-1 ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 rounded-full flex-1 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 rounded-full flex-1 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-border shadow-md">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-primary" />
                    Let's build your store
                  </CardTitle>
                  <CardDescription className="text-base">
                    Tell us what you sell, and our AI will help set up your storefront.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...describeForm}>
                    <form onSubmit={describeForm.handleSubmit(onDescribeSubmit)} className="space-y-6">
                      <FormField
                        control={describeForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                placeholder="E.g. I sell homemade organic coffee beans and brewing equipment in San Francisco." 
                                className="min-h-[120px] resize-none text-base"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        size="lg" 
                        className="w-full text-base" 
                        disabled={generateStore.isPending}
                      >
                        {generateStore.isPending ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            AI is crafting your store...
                          </>
                        ) : (
                          <>
                            Generate My Store
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                  <div className="mt-6 text-center">
                    <Button variant="link" onClick={() => setStep(2)} className="text-muted-foreground">
                      Skip AI setup
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-border shadow-md">
                <CardHeader>
                  <CardTitle className="text-2xl">Confirm your details</CardTitle>
                  <CardDescription className="text-base">
                    Review your store name and add the WhatsApp number where you want to receive orders.
                  </CardDescription>
                  {refCode && (
                    <div className="flex items-center gap-2 mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                      <Gift className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm text-primary">
                        Referral code <Badge variant="outline" className="font-mono text-primary border-primary/30 mx-1">{refCode}</Badge> will be applied automatically.
                      </span>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <Form {...detailsForm}>
                    <form onSubmit={detailsForm.handleSubmit(onDetailsSubmit)} className="space-y-6">
                      <FormField
                        control={detailsForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Store Name</FormLabel>
                            <FormControl>
                              <Input placeholder="My Awesome Store" className="h-12 text-base" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={detailsForm.control}
                        name="whatsappNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">WhatsApp Number</FormLabel>
                            <FormControl>
                              <Input placeholder="+1234567890" className="h-12 text-base" {...field} />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Include country code. This is where orders will be sent.</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        size="lg" 
                        className="w-full text-base" 
                        disabled={createStore.isPending}
                      >
                        {createStore.isPending ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : null}
                        Create Store
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="border-border shadow-md border-primary/20 text-center">
                <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold mb-3">Your store is live!</h2>
                  <p className="text-muted-foreground text-lg mb-8">
                    Your digital storefront is ready. Let's add some products and start selling.
                  </p>
                  <Button 
                    size="lg" 
                    className="w-full text-base h-14" 
                    onClick={() => setLocation(`${basePath}/dashboard`)}
                  >
                    <Store className="w-5 h-5 mr-2" />
                    Go to Dashboard
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
