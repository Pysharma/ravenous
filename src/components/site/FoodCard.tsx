"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { discountPercent, formatINR } from "@/lib/format";
import { SafeImage } from "@/components/site/SafeImage";
import { useCart, type MenuItemLite } from "@/components/site/CartProvider";

export type FoodCardItem = MenuItemLite & {
  shortDescription: string | null;
  mrp: number;
  ratingAvg: number;
  ratingCount: number;
  isBestseller: boolean;
  isPopular: boolean;
  isNew: boolean;
  isFeatured: boolean;
  isRecommended: boolean;
  spiceLevel: string;
  categoryName: string | null;
  isDemoData: boolean;
};

export function FoodCard({ item }: { item: FoodCardItem }) {
  const { addLine, openCustomize, favorites, toggleFavorite, quote } = useCart();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [added, setAdded] = useState(false);
  const isFavorite = favorites.includes(item.id);

  const defaultVariant = item.variants.find((v) => v.isDefault) ?? item.variants[0] ?? null;
  const price = defaultVariant?.price ?? item.basePrice;
  const mrp = defaultVariant ? Math.max(defaultVariant.mrp, defaultVariant.price) : Math.max(item.mrp, item.basePrice);
  const off = discountPercent(mrp, price);
  const available = item.isAvailable && (defaultVariant ? defaultVariant.isAvailable : true);
  const requiresChoice = item.hasCustomization || item.variants.length > 1 || item.addons.length > 0;

  const handlePointerMove = (event: React.PointerEvent) => {
    const card = cardRef.current;
    if (!card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 640) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(900px) rotateX(${(-y * 3.2).toFixed(2)}deg) rotateY(${(x * 3.6).toFixed(2)}deg) translateY(-4px)`;
  };

  const resetTilt = () => {
    const card = cardRef.current;
    if (card) card.style.transform = "";
  };

  const quickAdd = () => {
    if (!available) return;
    if (requiresChoice) {
      openCustomize(item);
      return;
    }
    addLine({
      menuItemId: item.id,
      variantId: null,
      name: item.name,
      slug: item.slug,
      imageUrl: item.imageUrl,
      variantName: null,
      foodType: item.foodType,
      unitPrice: price,
      addons: [],
      addonsTotal: 0,
      quantity: 1,
      notes: null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      className="tilt-card group relative flex flex-col overflow-hidden rounded-3xl border border-ink/8 bg-white shadow-[0_20px_45px_-38px_rgba(25,16,9,0.7)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Link href={`/menu/${item.slug}`} aria-label={`View ${item.name}`}>
          <SafeImage
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-700 group-hover:scale-105"
            loading="lazy"
          />
        </Link>
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="flex flex-wrap gap-1">
            {item.isBestseller ? <span className="badge badge-dark">⭐ Bestseller</span> : null}
            {item.isNew ? <span className="badge badge-gold">🆕 New</span> : null}
            {item.isDemoData ? <span className="badge badge-muted">Demo menu item</span> : null}
          </div>
          <button
            type="button"
            onClick={() => void toggleFavorite(item.id)}
            aria-label={isFavorite ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sm shadow"
          >
            {isFavorite ? "❤️" : "🤍"}
          </button>
        </div>
        {off > 0 ? <span className="badge badge-ember absolute bottom-3 left-3">{off}% off</span> : null}
      </div>

      <div className="tilt-inner flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <span className={item.foodType === "nonveg" ? "badge badge-nonveg" : item.foodType === "egg" ? "badge badge-egg" : "badge badge-veg"}>
            {item.foodType === "nonveg" ? "🔴 Non-veg" : item.foodType === "egg" ? "🥚 Egg" : "🌱 Veg"}
          </span>
          {item.ratingCount > 0 ? <span className="text-ink/60">★ {(item.ratingAvg / 10).toFixed(1)}</span> : null}
          <span className="ml-auto text-ink/50">{item.prepTimeMinutes} min</span>
        </div>
        <h3 className="mt-2 font-display text-lg leading-tight">
          <Link href={`/menu/${item.slug}`}>{item.name}</Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-ink/60">{item.shortDescription}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-lg font-semibold">{formatINR(price)}</span>
          {off > 0 ? <span className="text-sm text-ink/45 line-through">{formatINR(mrp)}</span> : null}
          {item.categoryName ? <span className="ml-auto text-xs text-ink/45">{item.categoryName}</span> : null}
        </div>
        {!available ? <p className="mt-2 text-xs font-semibold text-[#a12622]">🔴 Currently unavailable</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary flex-1 sm:flex-none" onClick={quickAdd} disabled={!available}>
            {added ? "Added ✓" : requiresChoice ? "Customize" : "+ Add"}
          </button>
          {requiresChoice ? (
            <button type="button" className="btn btn-outline flex-1 sm:flex-none" onClick={() => openCustomize(item)} disabled={!available}>
              Customize
            </button>
          ) : null}
          <Link href={`/menu/${item.slug}`} className="btn btn-outline flex-1 sm:flex-none text-center">
            View
          </Link>
        </div>
        {quote && !available ? <p className="mt-2 text-xs text-ink/50">Update your cart before checkout.</p> : null}
      </div>
    </article>
  );
}
