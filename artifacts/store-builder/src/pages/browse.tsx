import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useBrowseStores } from "@workspace/api-client-react";
import { Store, Search, ShoppingBag, ExternalLink, ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function StoreInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const colors = [
    "bg-emerald-500",
    "bg-sky-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-orange-500",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-14 h-14 rounded-xl ${color} flex items-center justify-center text-white font-bold text-xl shrink-0`}>
      {initials}
    </div>
  );
}

function StoreCard({ store, index }: { store: { id: number; name: string; slug: string; description?: string | null; logoUrl?: string | null; orderCount: number }; index: number }) {
  return (
    <motion.a
      href={`${basePath}/store/${store.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      className="group flex flex-col gap-3 rounded-2xl border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 p-5 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {store.logoUrl ? (
          <img src={store.logoUrl} alt={store.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
        ) : (
          <StoreInitials name={store.name} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight truncate">{store.name}</p>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">@{store.slug}</p>
        </div>
      </div>

      {store.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {store.description}
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-auto pt-1">
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/8 border border-primary/15">
          <ShoppingBag className="w-3 h-3 text-primary" />
          <span className="text-xs font-semibold text-primary">
            {store.orderCount.toLocaleString()} {store.orderCount === 1 ? "order" : "orders"}
          </span>
        </div>
      </div>
    </motion.a>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border bg-card p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-14 h-14 rounded-xl bg-muted shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted/60 rounded w-1/3" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-3 bg-muted/40 rounded w-full" />
        <div className="h-3 bg-muted/30 rounded w-4/5" />
      </div>
      <div className="mt-4 h-6 w-24 bg-muted/40 rounded-full" />
    </div>
  );
}

export default function BrowsePage() {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching } = useBrowseStores(
    { q: query || undefined, page },
    { query: { staleTime: 30_000 } }
  );

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(inputValue);
      setPage(1);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputValue]);

  // Scroll to top on page change
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  const stores = data?.stores ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const showSkeleton = isLoading;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Navbar */}
      <nav className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`${basePath}/`}>
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                <Store className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl tracking-tight">Zapp Store</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href={`${basePath}/sign-in`}>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign In</Button>
            </Link>
            <Link href={`${basePath}/sign-up`}>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12" ref={topRef}>
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Explore stores
            </h1>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Discover merchants selling on WhatsApp. Browse, shop, and see what's possible.
            </p>
          </motion.div>
        </div>

        {/* Search bar */}
        <div className="max-w-xl mx-auto mb-10 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-10 pr-10 h-12 rounded-xl text-base"
            placeholder="Search by name, category, or store handle…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoComplete="off"
          />
          {inputValue && (
            <button
              onClick={() => setInputValue("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Result count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <span className="inline-block w-24 h-4 bg-muted animate-pulse rounded" />
            ) : (
              <>
                {total === 0
                  ? "No stores found"
                  : `${total.toLocaleString()} store${total === 1 ? "" : "s"} found`}
                {query && (
                  <span>
                    {" "}for{" "}
                    <span className="font-medium text-foreground">"{query}"</span>
                  </span>
                )}
              </>
            )}
          </p>
          {isFetching && !isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">Searching…</span>
          )}
        </div>

        {/* Grid */}
        {showSkeleton ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : stores.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <Search className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No stores match your search</h3>
            <p className="text-muted-foreground mb-6">Try a different keyword or clear the search.</p>
            <Button variant="outline" onClick={() => setInputValue("")}>Clear search</Button>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${query}-${page}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {stores.map((store, i) => (
                <StoreCard key={store.id} store={store} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-12">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => p - 1)}
              className="gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
              className="gap-1.5"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-20 text-center rounded-3xl border bg-muted/30 p-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to open your store?</h2>
          <p className="text-muted-foreground mb-6">Join these merchants and start selling on WhatsApp in minutes.</p>
          <Link href={`${basePath}/sign-up`}>
            <Button size="lg" className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground">
              Create your free store <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
