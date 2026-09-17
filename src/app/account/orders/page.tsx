"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/site/CartProvider";
import { formatDateTime, formatINR } from "@/lib/format";

type OrderRow = {
  id: number;
  orderCode: string;
  status: string;
  statusLabel: string;
  orderType: string;
  total: number;
  paymentStatus: string;
  paymentMethod: string;
  itemCount: number;
  createdAt: string;
  eta: string;
};

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { addLine, toast, clearCart } = useCart();
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/orders", { cache: "no-store" });
        const data = (await response.json()) as { orders: OrderRow[] };
        setOrders(data.orders ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const reorder = async (orderId: number) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder" }),
      });
      const data = (await response.json()) as {
        lines?: { menuItemId: number; variantId: number | null; quantity: number; addonIds: number[]; notes: string | null }[];
        unavailable?: string[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "We could not reorder this.");
      clearCart();
      for (const line of data.lines ?? []) {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "quote", orderType: "delivery", lines: [line] }),
        });
      }
      if (data.unavailable?.length) {
        toast(`${data.unavailable.join(", ")} ${data.unavailable.length === 1 ? "is" : "are"} currently unavailable.`, "info");
      }
      // Rebuild the cart on the server-priced lines by re-adding through the menu API
      const detail = await fetch(`/api/menu?perPage=60`, { cache: "no-store" });
      const menu = (await detail.json()) as { items: { id: number; name: string; slug: string; imageUrl: string | null; basePrice: number; foodType: string; variants: { id: number; name: string; price: number; isDefault: boolean }[]; addons: { id: number; name: string; price: number }[] }[] };
      let added = 0;
      for (const line of data.lines ?? []) {
        const item = menu.items.find((candidate) => candidate.id === line.menuItemId);
        if (!item) continue;
        const variant = item.variants.find((v) => v.id === line.variantId) ?? null;
        addLine({
          menuItemId: item.id,
          variantId: variant?.id ?? null,
          name: item.name,
          slug: item.slug,
          imageUrl: item.imageUrl,
          variantName: variant?.name ?? null,
          foodType: item.foodType,
          unitPrice: variant?.price ?? item.basePrice,
          addons: (line.addonIds ?? [])
            .map((id) => item.addons.find((a) => a.id === id))
            .filter((a): a is { id: number; name: string; price: number } => Boolean(a))
            .map((a) => ({ addonId: a.id, name: a.name, price: a.price })),
          addonsTotal: 0,
          quantity: line.quantity,
          notes: line.notes,
        });
        added += 1;
      }
      if (added) {
        toast("Items added to your cart", "success");
        router.push("/cart");
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "We could not reorder this.", "error");
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="skeleton h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="card p-10 text-center">
        <p className="font-display text-2xl">No orders yet.</p>
        <Link href="/menu" className="btn btn-primary mt-4">
          Order Something Delicious
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => (
        <li key={order.id} className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg">{order.orderCode}</p>
              <p className="text-xs text-ink/55">
                {formatDateTime(order.createdAt)} · {order.orderType} · {order.itemCount} item(s) · {formatINR(order.total)}
              </p>
              <p className="mt-1 text-xs text-ink/55">
                Payment: {order.paymentMethod.toUpperCase()} · {order.paymentStatus.replace(/_/g, " ")}
              </p>
            </div>
            <span className="badge badge-ember">{order.statusLabel}</span>
          </div>
          <p className="mt-3 text-xs text-ink/55">{order.eta}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/account/orders/${order.id}`} className="btn btn-outline px-4 py-1.5 text-xs">
              View
            </Link>
            <Link href={`/track/${order.id}`} className="btn btn-outline px-4 py-1.5 text-xs">
              Track
            </Link>
            <button type="button" className="btn btn-outline px-4 py-1.5 text-xs" onClick={() => void reorder(order.id)}>
              Reorder
            </button>
            <Link href={`/account/orders/${order.id}/invoice`} className="btn btn-outline px-4 py-1.5 text-xs">
              Download Invoice
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
