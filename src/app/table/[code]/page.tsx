"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useCart, type MenuItemLite } from "@/components/site/CartProvider";
import { formatINR } from "@/lib/format";

type TableInfo = { id: number; code: string; tableNumber: string; capacity: number; section: string; status: string };
type Category = { id: number; name: string; slug: string; imageUrl: string | null; itemCount: number; prepTimeMinutes: number };
type MenuItem = MenuItemLite & { shortDescription: string | null; mrp: number; categoryId: number | null; isAvailable: boolean; hasCustomization: boolean };

type TableResponse = {
  table: TableInfo;
  dineInEnabled: boolean;
  restaurant: { name: string; phone: string; whatsapp: string };
  categories: Category[];
  items: MenuItem[];
  error?: string;
};

export default function TableOrderPage() {
  const params = useParams<{ code: string }>();
  const [data, setData] = useState<TableResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<{ id: number; orderCode: string } | null>(null);
  const { lines, addLine, openCustomize, quote, clearCart, toast } = useCart();

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/tables/${params.code}`, { cache: "no-store" });
      const payload = (await response.json()) as TableResponse;
      if (!response.ok) throw new Error(payload.error ?? "This table QR code is not valid.");
      setData(payload);
      window.localStorage.setItem("ravenous.orderType", "dinein");
      window.dispatchEvent(new CustomEvent("ravenous:order-type", { detail: { orderType: "dinein" } }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "This table QR code is not valid.");
    }
  }, [params.code]);

  useEffect(() => {
    void load();
  }, [load]);

  const placeOrder = async () => {
    if (!data) return;
    if (!lines.length) {
      toast("Add something to your order first.", "error");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      toast("Please add your name and phone so we can serve you.", "error");
      return;
    }
    setPlacing(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((line) => ({
            menuItemId: line.menuItemId,
            variantId: line.variantId,
            quantity: line.quantity,
            addonIds: line.addons.map((a) => a.addonId),
            notes: line.notes,
          })),
          orderType: "dinein",
          name,
          phone,
          paymentMethod: "counter",
          tableCode: data.table.code,
          note: "Dine-in table order",
        }),
      });
      const payload = (await response.json()) as { order?: { id: number; orderCode: string }; error?: string };
      if (!response.ok || !payload.order) throw new Error(payload.error ?? "We could not send your order to the kitchen.");
      setPlaced(payload.order);
      clearCart();
      toast("Order sent to the kitchen!", "success");
    } catch (placeError) {
      toast(placeError instanceof Error ? placeError.message : "We could not send your order.", "error");
    } finally {
      setPlacing(false);
    }
  };

  const requestBill = async () => {
    if (!placed) {
      toast("Place a table order first to request the bill.", "error");
      return;
    }
    const response = await fetch(`/api/orders/${placed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request-bill" }),
    });
    if (response.ok) toast("Bill requested — our staff is coming over.", "success");
    else toast("We could not request the bill. Please call our staff.", "error");
  };

  if (error) {
    return (
      <div className="container-page py-20 text-center">
        <p className="font-display text-2xl">{error}</p>
        <p className="mt-2 text-sm text-ink/60">Please scan the QR code again or ask our staff for assistance.</p>
        <Link href="/menu" className="btn btn-primary mt-5">
          View the menu
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container-page py-16">
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  const items = category ? data.items.filter((item) => item.categoryId === category) : data.items;

  return (
    <div className="container-page py-8">
      <div className="card-dark flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="badge badge-gold">Dine-in · {data.table.section}</p>
          <h1 className="mt-2 font-display text-3xl text-cream">Table {data.table.tableNumber}</h1>
          <p className="text-xs text-cream/60">
            {data.table.capacity} seats · {data.dineInEnabled ? "Table ordering active" : "Table ordering is currently paused"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${data.restaurant.phone.replace(/\s/g, "")}`} className="btn btn-gold">
            Call staff
          </a>
          <button type="button" className="btn btn-outline !border-cream/30 !text-cream" onClick={requestBill}>
            Request bill
          </button>
        </div>
      </div>

      {placed ? (
        <div className="card mt-4 p-5">
          <p className="badge badge-veg">Order sent to the kitchen</p>
          <p className="mt-3 font-display text-2xl">Order #{placed.orderCode}</p>
          <p className="mt-1 text-sm text-ink/65">Our kitchen is preparing your food. You can add more items any time from this page.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/track/${placed.id}`} className="btn btn-outline">
              Track this order
            </Link>
            <button type="button" className="btn btn-primary" onClick={requestBill}>
              Request bill
            </button>
          </div>
        </div>
      ) : null}

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        <button type="button" className={`badge px-3 py-1.5 text-xs ${category === null ? "badge-ember" : "badge-muted"}`} onClick={() => setCategory(null)}>
          All items
        </button>
        {data.categories.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`badge whitespace-nowrap px-3 py-1.5 text-xs ${category === entry.id ? "badge-ember" : "badge-muted"}`}
            onClick={() => setCategory(entry.id)}
          >
            {entry.name} ({entry.itemCount})
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-ink/55">{item.shortDescription}</p>
                </div>
                <p className="font-semibold">{formatINR(item.variants[0]?.price ?? item.basePrice)}</p>
              </div>
              <p className="mt-1 text-xs text-ink/45">{item.prepTimeMinutes} min</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary px-3 py-1 text-xs"
                  disabled={!item.isAvailable}
                  onClick={() => {
                    if (item.hasCustomization || item.variants.length || item.addons.length) {
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
                      unitPrice: item.basePrice,
                      addons: [],
                      addonsTotal: 0,
                      quantity: 1,
                      notes: null,
                    });
                  }}
                >
                  {item.isAvailable ? "+ Add" : "Unavailable"}
                </button>
                {item.hasCustomization ? (
                  <button type="button" className="btn btn-outline px-3 py-1 text-xs" onClick={() => openCustomize(item)}>
                    Customize
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="card p-5">
            <h2 className="font-display text-xl">Your table order</h2>
            {lines.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {lines.map((line) => (
                  <li key={line.key} className="flex justify-between">
                    <span>
                      {line.quantity} × {line.name}
                      {line.variantName ? ` (${line.variantName})` : ""}
                    </span>
                    <span>{formatINR((line.unitPrice + line.addonsTotal) * line.quantity)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink/60">Your table order is empty. Add dishes from the menu on the left.</p>
            )}
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{quote ? formatINR(quote.subtotal) : "—"}</dd></div>
              <div className="flex justify-between"><dt>Taxes</dt><dd>{quote ? formatINR(quote.taxTotal) : "—"}</dd></div>
              <div className="flex justify-between font-display text-lg"><dt>Total</dt><dd>{quote ? formatINR(quote.total) : "—"}</dd></div>
            </dl>
            <div className="mt-4 grid gap-2">
              <input className="input" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
              <input className="input" placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
            </div>
            <button type="button" className="btn btn-primary mt-4 w-full py-3" onClick={placeOrder} disabled={placing || !lines.length}>
              {placing ? "Sending to kitchen…" : "Send order to kitchen"}
            </button>
            <p className="mt-3 text-xs text-ink/50">Pay at the counter or with your server when you are ready. Request the bill from the button above.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
