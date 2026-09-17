"use client";

import Link from "next/link";
import { useState } from "react";
import { SafeImage } from "@/components/site/SafeImage";
import { useCart } from "@/components/site/CartProvider";
import { formatINR } from "@/lib/format";

const ORDER_TYPES = [
  { id: "delivery", label: "Delivery" },
  { id: "pickup", label: "Pickup" },
  { id: "dinein", label: "Dine-in" },
] as const;

export default function CartPage() {
  const { lines, saved, quote, quoting, updateQuantity, removeLine, saveForLater, restoreSaved, couponCode, setCouponCode, clearCart, brand, toast } = useCart();
  const [couponInput, setCouponInput] = useState(couponCode ?? "");
  const [orderType, setOrderType] = useState<"delivery" | "pickup" | "dinein">("delivery");

  const changeType = (type: "delivery" | "pickup" | "dinein") => {
    setOrderType(type);
    window.dispatchEvent(new CustomEvent("ravenous:order-type", { detail: { orderType: type } }));
  };

  if (!lines.length) {
    return (
      <div className="container-page py-20 text-center">
        <p className="font-display text-3xl">Your cart is hungry. 🍽️</p>
        <p className="mt-2 text-sm text-ink/60">Add something delicious to get started.</p>
        <Link href="/menu" className="btn btn-primary mt-6">
          Explore Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[1.4fr_1fr]">
      <section>
        <h1 className="font-display text-3xl">Your cart</h1>
        <p className="mt-1 text-sm text-ink/60">{lines.reduce((sum, l) => sum + l.quantity, 0)} item(s) from {brand.shortName}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {ORDER_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => changeType(type.id)}
              className={`badge border ${orderType === type.id ? "border-ember bg-ember/15 text-[#9c3f1c]" : "border-ink/12 text-ink/65"}`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <ul className="mt-5 space-y-3">
          {lines.map((line) => (
            <li key={line.key} className="card flex gap-4 p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
                <SafeImage src={line.imageUrl} alt={line.name} fill sizes="80px" className="object-cover" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {line.name}
                      {line.variantName ? <span className="text-ink/60"> · {line.variantName}</span> : null}
                    </p>
                    <p className="text-xs text-ink/55">
                      {line.foodType === "nonveg" ? "🔴 Non-veg" : line.foodType === "egg" ? "🥚 Egg" : "🌱 Veg"}
                      {line.addons.length ? ` · + ${line.addons.map((a) => a.name).join(", ")}` : ""}
                    </p>
                    {line.notes ? <p className="mt-1 text-xs italic text-ink/50">“{line.notes}”</p> : null}
                  </div>
                  <p className="font-semibold">{formatINR(line.unitPrice + line.addonsTotal)}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button type="button" className="btn btn-outline h-8 w-8 p-0" onClick={() => updateQuantity(line.key, line.quantity - 1)} aria-label={`Reduce ${line.name} quantity`}>
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                    <button type="button" className="btn btn-outline h-8 w-8 p-0" onClick={() => updateQuantity(line.key, line.quantity + 1)} aria-label={`Increase ${line.name} quantity`}>
                      +
                    </button>
                  </div>
                  <button type="button" className="text-xs font-semibold text-ink/55 underline" onClick={() => saveForLater(line.key)}>
                    Save for later
                  </button>
                  <button type="button" className="text-xs font-semibold text-[#a12622] underline" onClick={() => removeLine(line.key)}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {saved.length ? (
          <div className="mt-8">
            <h2 className="font-display text-xl">Saved for later</h2>
            <ul className="mt-3 space-y-2">
              {saved.map((line) => (
                <li key={line.key} className="card flex items-center justify-between gap-3 p-3 text-sm">
                  <span>
                    {line.name}
                    {line.variantName ? ` · ${line.variantName}` : ""} · {formatINR(line.unitPrice + line.addonsTotal)}
                  </span>
                  <button type="button" className="btn btn-outline px-3 py-1 text-xs" onClick={() => restoreSaved(line.key)}>
                    Move to cart
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/menu" className="btn btn-outline">
            Add more items
          </Link>
          <button
            type="button"
            className="btn btn-outline text-[#a12622]"
            onClick={() => {
              clearCart();
              toast("Cart cleared", "info");
            }}
          >
            Clear cart
          </button>
        </div>
      </section>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="card p-5">
          <h2 className="font-display text-xl">Have a coupon?</h2>
          <div className="mt-3 flex gap-2">
            <input className="input" placeholder="Enter code" value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} />
            <button type="button" className="btn btn-dark" onClick={() => setCouponCode(couponInput || null)}>
              Apply
            </button>
          </div>
          {quote?.couponMessage ? (
            <p className={`mt-2 text-xs font-semibold ${quote.couponCode ? "text-[#23663a]" : "text-[#a12622]"}`}>
              {quote.couponCode ? "✓ " : "❌ "}
              {quote.couponMessage}
            </p>
          ) : null}
        </div>

        <div className="card mt-4 p-5">
          <h2 className="font-display text-xl">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/65">Subtotal</dt>
              <dd>{quote ? formatINR(quote.subtotal) : "—"}</dd>
            </div>
            {quote && quote.discountTotal > 0 ? (
              <div className="flex justify-between text-[#23663a]">
                <dt>Discount {quote.couponCode ? `(${quote.couponCode})` : ""}</dt>
                <dd>−{formatINR(quote.discountTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-ink/65">Taxes</dt>
              <dd>{quote ? formatINR(quote.taxTotal) : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/65">Packaging</dt>
              <dd>{quote ? formatINR(quote.packagingFee) : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/65">
                Delivery {quote?.freeDelivery ? <span className="badge badge-veg ml-1">Free</span> : null}
              </dt>
              <dd>{quote ? formatINR(quote.deliveryFee) : "—"}</dd>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-2 font-display text-xl">
              <dt>Total</dt>
              <dd>{quote ? formatINR(quote.total) : "—"}</dd>
            </div>
          </dl>

          {quote?.distanceKm !== null && quote?.distanceKm !== undefined ? (
            <p className="mt-3 text-xs text-ink/55">
              Distance from restaurant: {quote.distanceKm} km {quote.zoneName ? `· ${quote.zoneName}` : ""}
            </p>
          ) : null}
          {quote && !quote.serviceable ? (
            <div className="mt-3 rounded-2xl bg-[#fdecea] p-3 text-xs text-[#a12622]">
              <p className="font-semibold">We&apos;re sorry, Ravenous currently doesn&apos;t deliver to this location.</p>
              <p className="mt-1">You can dine at Ravenous or call us to arrange something else.</p>
              <div className="mt-2 flex gap-2">
                <a className="btn btn-outline px-3 py-1 text-xs" href={`tel:${brand.phone.replace(/\s/g, "")}`}>
                  Contact Restaurant
                </a>
                <Link className="btn btn-outline px-3 py-1 text-xs" href="/reservations">
                  Dine at Ravenous
                </Link>
              </div>
            </div>
          ) : null}
          {quote?.belowMinimum ? (
            <p className="mt-3 text-xs font-semibold text-[#a12622]">Minimum order value is {formatINR(quote.minOrderPaise)} for this order type.</p>
          ) : null}
          {quote?.issues?.length ? <p className="mt-3 text-xs text-[#a12622]">{quote.issues[0]}</p> : null}

          <Link
            href="/checkout"
            className={`btn btn-primary mt-4 w-full py-3 text-base ${quote && (!quote.serviceable || quote.belowMinimum) ? "pointer-events-none opacity-50" : ""}`}
            aria-disabled={Boolean(quote && (!quote.serviceable || quote.belowMinimum))}
          >
            {quoting ? "Updating…" : "Proceed to checkout"}
          </Link>
          <p className="mt-3 text-center text-xs text-ink/50">Prices are recalculated on our servers at checkout for accuracy.</p>
        </div>
      </aside>
    </div>
  );
}
