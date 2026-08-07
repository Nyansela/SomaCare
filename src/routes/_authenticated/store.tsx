import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Star, ShoppingCart, Plus, Minus, Search, Trash2, ShieldCheck, Truck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { STORE_CATALOG, STORE_CATEGORIES, CATEGORY_FALLBACK, type StoreItem } from "@/lib/store-catalog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/store")({
  head: () => ({
    meta: [
      { title: "Store — SomaCare" },
      { name: "description", content: "Buy clinical devices, medications and wellness essentials, delivered from SomaLabsGH." },
    ],
  }),
  component: StorePage,
});

type CartLine = { item: StoreItem; qty: number };

function StorePage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof STORE_CATEGORIES)[number]>("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);

  const items = useMemo(() => {
    return STORE_CATALOG.filter((i) => {
      if (cat !== "All" && i.category !== cat) return false;
      if (!q) return true;
      return (i.name + " " + i.short).toLowerCase().includes(q.toLowerCase());
    });
  }, [q, cat]);

  const add = (item: StoreItem) => {
    setCart((prev) => {
      const found = prev.find((l) => l.item.id === item.id);
      if (found) return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { item, qty: 1 }];
    });
    toast.success(`${item.name} added to cart`);
  };

  const setQty = (id: string, qty: number) => {
    setCart((prev) =>
      qty <= 0 ? prev.filter((l) => l.item.id !== id) : prev.map((l) => (l.item.id === id ? { ...l, qty } : l)),
    );
  };

  const subtotal = cart.reduce((s, l) => s + l.item.price * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  return (
    <AppShell
      title="Store"
      subtitle="Clinical devices, medications & wellness — delivered"
      action={
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="soma-gradient soma-glow border-0 text-white">
              <ShoppingCart className="mr-1.5 h-4 w-4" />
              Cart {count > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{count}</span>}
            </Button>
          </SheetTrigger>
          <SheetContent className="flex w-full flex-col sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="font-display">Your cart</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto py-4">
              {cart.length === 0 ? (
                <p className="mt-8 text-center text-sm text-muted-foreground">Your cart is empty.</p>
              ) : (
                <ul className="space-y-3">
                  {cart.map((l) => (
                    <li key={l.item.id} className="flex gap-3 rounded-xl border border-border p-2">
                      <img src={l.item.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{l.item.name}</div>
                        <div className="text-xs text-muted-foreground">${l.item.price.toFixed(2)}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            onClick={() => setQty(l.item.id, l.qty - 1)}
                            className="grid h-6 w-6 place-items-center rounded-md border border-border"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-semibold">{l.qty}</span>
                          <button
                            onClick={() => setQty(l.item.id, l.qty + 1)}
                            className="grid h-6 w-6 place-items-center rounded-md border border-border"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setQty(l.item.id, 0)}
                            className="ml-auto text-muted-foreground hover:text-destructive"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-border pt-3">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-display text-lg font-bold">${subtotal.toFixed(2)}</span>
              </div>
              <Button
                disabled={cart.length === 0}
                onClick={() => {
                  toast.success("Order placed — demo checkout");
                  setCart([]);
                  setOpen(false);
                }}
                className="w-full soma-gradient soma-glow border-0 text-white"
              >
                Checkout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      }
    >
      <div className="space-y-6">
        {/* Hero */}
        <Card className="overflow-hidden">
          <CardContent className="grid gap-4 p-6 md:grid-cols-[1fr,auto] md:items-center">
            <div>
              <Badge className="soma-gradient border-0 text-white">SomaLabsGH Pharmacy</Badge>
              <h2 className="mt-3 font-display text-2xl font-bold">
                Clinical-grade care, delivered to your door.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Verified suppliers, licensed pharmacists, and same-day dispatch on eligible orders.
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Rx-verified</span>
                <span className="inline-flex items-center gap-1.5"><Truck className="h-4 w-4 text-primary" /> Free shipping over $35</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search medications, devices…"
              className="pl-9"
            />
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto md:mx-0">
            {STORE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  cat === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item, i) => (
            <ProductCard key={item.id} item={item} onAdd={add} index={i} />
          ))}
          {items.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No products match your search.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ProductCard({ item, onAdd, index }: { item: StoreItem; onAdd: (i: StoreItem) => void; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.3 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-25px_var(--color-primary)]"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary/40">
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget;
            if (el.dataset.fallback !== "1") {
              el.dataset.fallback = "1";
              el.src = CATEGORY_FALLBACK[item.category];
            }
          }}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        {item.badge && (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary shadow">
            {item.badge}
          </span>
        )}
        {item.prescription && (
          <span className="absolute right-2 top-2 rounded-full bg-destructive/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            Rx
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{item.category}</div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{item.name}</h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">{item.short}</p>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-warning text-warning" />
          <span className="font-medium text-foreground">{item.rating}</span>
          <span>({item.reviews.toLocaleString()})</span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="font-display text-lg font-bold">${item.price.toFixed(2)}</div>
          <Button
            size="sm"
            onClick={() => onAdd(item)}
            className="soma-gradient soma-glow border-0 text-white"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
