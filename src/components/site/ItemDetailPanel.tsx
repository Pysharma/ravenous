"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatINR } from "@/lib/format";
import { useCart, type MenuItemLite } from "@/components/site/CartProvider";

const SPICE = [
  { id: "mild", label: "Mild" },
  { id: "medium", label: "Medium" },
  { id: "spicy", label: "Spicy" },
  { id: "extra_spicy", label: "Extra Spicy" },
];

const PREFS = ["No Onion", "No Garlic", "Jain", "Less Oil", "Less Spicy"];

export function ItemDetailPanel({ item }: { item: MenuItemLite }) {
  const { addLine, favorites, toggleFavorite, toast } = useCart();
  const router = useRouter();
  const defaultVariant = item.variants.find((v) => v.isDefault) ?? item.variants[0] ?? null;
  const [variantId, setVariantId] = useState<number | null>(defaultVariant?.id ?? null);
  const [addonIds, setAddonIds] = useState<number[]>([]);
  const [spice, setSpice] = useState("medium");
  const [prefs, setPrefs] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);

  const variant = item.variants.find((v) => v.id === variantId) ?? null;
  const unitPrice = variant?.price ?? item.basePrice;
  const addonsTotal = item.addons.filter((a) => addonIds.includes(a.id)).reduce((sum, a) => sum + a.price, 0);
  const total = (unitPrice + addonsTotal) * quantity;
  const isFavorite = favorites.includes(item.id);

  const buildLine = () => ({
    menuItemId: item.id,
    variantId: variant?.id ?? null,
    name: item.name,
    slug: item.slug,
    imageUrl: item.imageUrl,
    variantName: variant?.name ?? null,
    foodType: item.foodType,
    unitPrice,
    addons: item.addons.filter((a) => addonIds.includes(a.id)).map((a) => ({ addonId: a.id, name: a.name, price: a.price })),
    addonsTotal,
    quantity,
    notes: [notes.trim(), prefs.length ? `Preferences: ${prefs.join(", ")}` : "", `Spice: ${spice}`].filter(Boolean).join(" | ") || null,
  });

  const requireAvailable = () => {
    if (!item.isAvailable) {
      toast(`${item.name} is currently unavailable.`, "error");
      return false;
    }
    return true;
  };

  return (
    <div className="card p-5">
      {item.variants.length ? (
        <fieldset>
          <legend className="label">Choose size</legend>
          <div className="flex flex-wrap gap-2">
            {item.variants.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={!option.isAvailable}
                onClick={() => setVariantId(option.id)}
                className={`badge border px-3 py-1 text-xs ${variantId === option.id ? "border-ember bg-ember/15 text-[#9c3f1c]" : "border-ink/12 text-ink/70"}`}
              >
                {option.name} · {formatINR(option.price)}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="mt-5">
        <legend className="label">Spice level</legend>
        <div className="flex flex-wrap gap-2">
          {SPICE.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSpice(option.id)}
              className={`badge border ${spice === option.id ? "border-ember bg-ember/15 text-[#9c3f1c]" : "border-ink/12 text-ink/70"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {item.addons.length ? (
        <fieldset className="mt-5">
          <legend className="label">Add-ons</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {item.addons.map((addon) => (
              <label key={addon.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-ink/12 p-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={addonIds.includes(addon.id)}
                    onChange={() =>
                      setAddonIds((prev) => (prev.includes(addon.id) ? prev.filter((id) => id !== addon.id) : [...prev, addon.id]))
                    }
                  />
                  {addon.name}
                </span>
                <span className="text-ink/60">{addon.price ? `+${formatINR(addon.price)}` : "Free"}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="mt-5">
        <legend className="label">Preferences</legend>
        <div className="flex flex-wrap gap-2">
          {PREFS.map((preference) => (
            <button
              key={preference}
              type="button"
              onClick={() => setPrefs((prev) => (prev.includes(preference) ? prev.filter((p) => p !== preference) : [...prev, preference]))}
              className={`badge border ${prefs.includes(preference) ? "border-moss bg-moss/15 text-moss" : "border-ink/12 text-ink/70"}`}
            >
              {preference}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <label className="label" htmlFor="item-notes">
          Special instructions
        </label>
        <textarea
          id="item-notes"
          className="textarea"
          rows={2}
          maxLength={200}
          placeholder="Please make it less spicy."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-outline h-9 w-9 p-0 text-lg" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            −
          </button>
          <span className="w-6 text-center font-semibold">{quantity}</span>
          <button type="button" className="btn btn-outline h-9 w-9 p-0 text-lg" onClick={() => setQuantity((q) => Math.min(30, q + 1))} aria-label="Increase quantity">
            +
          </button>
        </div>
        <p className="font-display text-2xl">{formatINR(total)}</p>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="btn btn-primary py-3 text-base"
          disabled={!item.isAvailable}
          onClick={() => {
            if (!requireAvailable()) return;
            addLine(buildLine());
          }}
        >
          Add to Cart
        </button>
        <button
          type="button"
          className="btn btn-dark py-3 text-base"
          disabled={!item.isAvailable}
          onClick={() => {
            if (!requireAvailable()) return;
            addLine(buildLine());
            router.push("/checkout");
          }}
        >
          Buy Now
        </button>
      </div>
      <button type="button" className="btn btn-outline mt-2 w-full" onClick={() => void toggleFavorite(item.id)}>
        {isFavorite ? "❤️ Remove from favourites" : "🤍 Add to Favorites"}
      </button>
      {!item.isAvailable ? (
        <p className="mt-3 text-center text-sm font-semibold text-[#a12622]">🔴 Currently unavailable — please check back later.</p>
      ) : null}
    </div>
  );
}
