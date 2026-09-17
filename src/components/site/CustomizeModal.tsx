"use client";

import { useMemo, useState } from "react";
import { formatINR } from "@/lib/format";
import { useCart, type MenuItemLite } from "@/components/site/CartProvider";

const SPICE_OPTIONS = [
  { id: "mild", label: "Mild" },
  { id: "medium", label: "Medium" },
  { id: "spicy", label: "Spicy" },
  { id: "extra_spicy", label: "Extra Spicy" },
];

const PREFERENCES = ["No Onion", "No Garlic", "Jain", "Less Oil", "Less Spicy", "Extra Gravy"];

export function CustomizeModal({ item, onClose }: { item: MenuItemLite; onClose: () => void }) {
  const { addLine, toast } = useCart();
  const defaultVariant = item.variants.find((v) => v.isDefault) ?? item.variants[0] ?? null;
  const [variantId, setVariantId] = useState<number | null>(defaultVariant?.id ?? null);
  const [selectedAddons, setSelectedAddons] = useState<number[]>([]);
  const [spice, setSpice] = useState<string>("medium");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const variant = useMemo(() => item.variants.find((v) => v.id === variantId) ?? null, [item.variants, variantId]);
  const unitPrice = variant?.price ?? item.basePrice;
  const addonsTotal = item.addons.filter((a) => selectedAddons.includes(a.id)).reduce((sum, a) => sum + a.price, 0);
  const lineTotal = (unitPrice + addonsTotal) * quantity;

  const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Customise ${item.name}`}>
      <div className="card max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{item.name}</h2>
            <p className="text-sm text-ink/60">
              {item.foodType === "nonveg" ? "🔴 Non-veg" : item.foodType === "egg" ? "🥚 Egg" : "🌱 Veg"} · {item.prepTimeMinutes} min
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-outline px-3 py-1 text-xs" aria-label="Close customisation">
            Close
          </button>
        </div>

        {item.variants.length ? (
          <fieldset className="mt-5">
            <legend className="label">Choose size</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {item.variants.map((v) => (
                <label
                  key={v.id}
                  className={`cursor-pointer rounded-2xl border p-3 text-sm transition ${
                    variantId === v.id ? "border-ember bg-ember/10" : "border-ink/12 hover:border-ink/30"
                  } ${v.isAvailable ? "" : "opacity-50"}`}
                >
                  <input
                    type="radio"
                    name="variant"
                    className="sr-only"
                    checked={variantId === v.id}
                    onChange={() => setVariantId(v.id)}
                    disabled={!v.isAvailable}
                  />
                  <span className="block font-semibold">{v.name}</span>
                  <span className="text-ink/70">{formatINR(v.price)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="mt-5">
          <legend className="label">Spice level</legend>
          <div className="flex flex-wrap gap-2">
            {SPICE_OPTIONS.map((option) => (
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
                <label key={addon.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-ink/12 p-3 text-sm">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedAddons.includes(addon.id)}
                      onChange={() => setSelectedAddons((prev) => toggle(prev, addon.id))}
                    />
                    {addon.name}
                  </span>
                  <span className="text-ink/70">{addon.price ? `+${formatINR(addon.price)}` : "Free"}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="mt-5">
          <legend className="label">Preferences</legend>
          <div className="flex flex-wrap gap-2">
            {PREFERENCES.map((preference) => (
              <button
                key={preference}
                type="button"
                onClick={() => setPreferences((prev) => (prev.includes(preference) ? prev.filter((p) => p !== preference) : [...prev, preference]))}
                className={`badge border ${preferences.includes(preference) ? "border-moss bg-moss/15 text-moss" : "border-ink/12 text-ink/70"}`}
              >
                {preference}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <label className="label" htmlFor="customize-notes">
            Special instructions
          </label>
          <textarea
            id="customize-notes"
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
          <p className="text-lg font-semibold">{formatINR(lineTotal)}</p>
        </div>

        <button
          type="button"
          className="btn btn-primary mt-4 w-full py-3 text-base"
          disabled={!item.isAvailable}
          onClick={() => {
            if (!item.isAvailable) {
              toast(`${item.name} is currently unavailable.`, "error");
              return;
            }
            const extraNotes = [notes.trim(), preferences.length ? `Preferences: ${preferences.join(", ")}` : "", `Spice: ${spice}`]
              .filter(Boolean)
              .join(" | ");
            addLine({
              menuItemId: item.id,
              variantId: variant?.id ?? null,
              name: item.name,
              slug: item.slug,
              imageUrl: item.imageUrl,
              variantName: variant?.name ?? null,
              foodType: item.foodType,
              unitPrice,
              addons: item.addons.filter((a) => selectedAddons.includes(a.id)).map((a) => ({ addonId: a.id, name: a.name, price: a.price })),
              addonsTotal,
              quantity,
              notes: extraNotes || null,
            });
            onClose();
          }}
        >
          {item.isAvailable ? `Add to cart · ${formatINR(lineTotal)}` : "Currently unavailable"}
        </button>
      </div>
    </div>
  );
}
