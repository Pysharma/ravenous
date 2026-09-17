"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/format";
import { CustomizeModal } from "@/components/site/CustomizeModal";

export type CartAddon = { addonId: number; name: string; price: number };
export type CartLine = {
  key: string;
  menuItemId: number;
  variantId: number | null;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  variantName: string | null;
  foodType: string;
  unitPrice: number;
  addons: CartAddon[];
  addonsTotal: number;
  quantity: number;
  notes: string | null;
};

export type MenuItemLite = {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  basePrice: number;
  mrp: number;
  foodType: string;
  prepTimeMinutes: number;
  hasCustomization: boolean;
  isAvailable: boolean;
  variants: { id: number; name: string; price: number; mrp: number; isDefault: boolean; isAvailable: boolean }[];
  addons: { id: number; name: string; price: number; groupLabel?: string }[];
};

export type BrandInfo = {
  name: string;
  shortName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  logoUrl: string | null;
  city: string;
  address: string;
  open: boolean;
  statusMessage: string | null;
  todayHours: string;
  publicRating: string;
  publicReviewCount: number;
  email: string;
  priceRange: string;
  services: string;
  mapsUrl: string | null;
  latitude: string | null;
  longitude: string | null;
  social: Record<string, string>;
  deliveryEnabled: boolean;
  reservationEnabled: boolean;
};

export type SessionUser = { id: number; name: string; email: string; phone: string | null } | null;

export type Quote = {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  packagingFee: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
  distanceKm: number | null;
  zoneName: string | null;
  serviceable: boolean;
  serviceMessage: string | null;
  minOrderPaise: number;
  belowMinimum: boolean;
  couponCode: string | null;
  couponMessage: string | null;
  freeDelivery: boolean;
  etaMinutes: number;
  prepTimeMinutes: number;
  issues: string[];
  lines?: { menuItemId: number; variantId: number | null; unitPrice: number; lineSubtotal: number; quantity: number; name: string; variantName: string | null; addons: CartAddon[]; isAvailable: boolean }[];
};

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

type CartContextValue = {
  brand: BrandInfo;
  lines: CartLine[];
  saved: CartLine[];
  quote: Quote | null;
  quoting: boolean;
  couponCode: string | null;
  setCouponCode: (code: string | null) => void;
  addLine: (line: Omit<CartLine, "key">) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  saveForLater: (key: string) => void;
  restoreSaved: (key: string) => void;
  favorites: number[];
  toggleFavorite: (menuItemId: number) => Promise<void>;
  user: SessionUser;
  refreshUser: () => Promise<void>;
  toast: (message: string, tone?: Toast["tone"]) => void;
  openCustomize: (item: MenuItemLite) => void;
  cartCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "ravenous.cart.v1";
const SAVED_KEY = "ravenous.saved.v1";

export function lineKey(line: Omit<CartLine, "key">) {
  return `${line.menuItemId}-${line.variantId ?? 0}-${line.addons
    .map((a) => a.addonId)
    .sort()
    .join("_")}-${(line.notes ?? "").slice(0, 24)}`;
}

export function CartProvider({ brand, children }: { brand: BrandInfo; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [saved, setSaved] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [user, setUser] = useState<SessionUser>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [customizeItem, setCustomizeItem] = useState<MenuItemLite | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<"delivery" | "pickup" | "dinein">("delivery");
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
      const savedRaw = window.localStorage.getItem(SAVED_KEY);
      if (savedRaw) setSaved(JSON.parse(savedRaw));
      const storedType = window.localStorage.getItem("ravenous.orderType");
      if (storedType === "pickup" || storedType === "dinein" || storedType === "delivery") setOrderType(storedType);
    } catch {
      // ignore corrupted storage
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ orderType: "delivery" | "pickup" | "dinein" }>).detail;
      if (detail?.orderType) {
        setOrderType(detail.orderType);
        window.localStorage.setItem("ravenous.orderType", detail.orderType);
      }
    };
    window.addEventListener("ravenous:order-type", handler);
    return () => window.removeEventListener("ravenous:order-type", handler);
  }, []);

  const toast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth", { cache: "no-store" });
      const data = (await response.json()) as { user: SessionUser };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
    void (async () => {
      try {
        const response = await fetch("/api/favorites", { cache: "no-store" });
        const data = (await response.json()) as { ids: number[] };
        setFavorites(data.ids ?? []);
      } catch {
        setFavorites([]);
      }
    })();
  }, [refreshUser]);

  // Server-side totals: the backend always recalculates the order.
  useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        const response = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "quote",
            orderType,
            couponCode: couponCode ?? undefined,
            lines: lines.map((line) => ({
              menuItemId: line.menuItemId,
              variantId: line.variantId,
              quantity: line.quantity,
              addonIds: line.addons.map((a) => a.addonId),
              notes: line.notes,
            })),
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as { cart?: Quote };
        if (data.cart) setQuote(data.cart);
      } catch {
        // network hiccup – keep the previous quote
      } finally {
        setQuoting(false);
      }
    }, 320);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [lines, orderType, couponCode]);

  const addLine = useCallback(
    (line: Omit<CartLine, "key">) => {
      const key = lineKey(line);
      setLines((prev) => {
        const existing = prev.find((l) => l.key === key);
        if (existing) {
          return prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(l.quantity + line.quantity, 30) } : l));
        }
        return [...prev, { ...line, key }];
      });
      toast(`${line.name} added to cart`);
    },
    [toast],
  );

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(quantity, 30) } : l)),
    );
  }, []);

  const removeLine = useCallback((key: string) => setLines((prev) => prev.filter((l) => l.key !== key)), []);
  const clearCart = useCallback(() => {
    setLines([]);
    setCouponCode(null);
  }, []);
  const saveForLater = useCallback((key: string) => {
    setLines((prev) => {
      const line = prev.find((l) => l.key === key);
      if (line) setSaved((s) => (s.some((item) => item.key === key) ? s : [...s, line]));
      return prev.filter((l) => l.key !== key);
    });
  }, []);
  const restoreSaved = useCallback(
    (key: string) => {
      setSaved((prev) => {
        const line = prev.find((l) => l.key === key);
        if (line) addLine(line);
        return prev.filter((l) => l.key !== key);
      });
    },
    [addLine],
  );

  const toggleFavorite = useCallback(
    async (menuItemId: number) => {
      if (!user) {
        toast("Please sign in to save favourites.", "error");
        return;
      }
      const wasFavorite = favorites.includes(menuItemId);
      setFavorites((prev) => (wasFavorite ? prev.filter((id) => id !== menuItemId) : [...prev, menuItemId]));
      try {
        const response = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ menuItemId }),
        });
        if (!response.ok) throw new Error("failed");
        toast(wasFavorite ? "Removed from favourites" : "Saved to favourites", "info");
      } catch {
        setFavorites((prev) => (wasFavorite ? [...prev, menuItemId] : prev.filter((id) => id !== menuItemId)));
        toast("We could not update your favourites. Please try again.", "error");
      }
    },
    [favorites, toast, user],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      brand,
      lines,
      saved,
      quote,
      quoting,
      couponCode,
      setCouponCode,
      addLine,
      updateQuantity,
      removeLine,
      clearCart,
      saveForLater,
      restoreSaved,
      favorites,
      toggleFavorite,
      user,
      refreshUser,
      toast,
      openCustomize: setCustomizeItem,
      cartCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    }),
    [brand, lines, saved, quote, quoting, couponCode, addLine, updateQuantity, removeLine, clearCart, saveForLater, restoreSaved, favorites, toggleFavorite, user, refreshUser, toast],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {customizeItem ? <CustomizeModal item={customizeItem} onClose={() => setCustomizeItem(null)} /> : null}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-8">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
              t.tone === "error" ? "bg-[#a12622] text-white" : t.tone === "info" ? "bg-ink text-cream" : "bg-[#23663a] text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
      {lines.length ? (
        <div className="fixed inset-x-0 bottom-0 z-[70] p-3 md:hidden">
          <Link
            href="/cart"
            className="btn btn-primary w-full justify-between px-5 py-3 text-base shadow-2xl"
            aria-label={`View cart, ${quote ? formatINR(quote.total) : `${lines.length} items`}`}
          >
            <span>View Cart · {lines.reduce((sum, l) => sum + l.quantity, 0)} item(s)</span>
            <span>{quote ? formatINR(quote.total) : "—"}</span>
          </Link>
        </div>
      ) : null}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
