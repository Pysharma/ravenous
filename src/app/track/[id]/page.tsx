"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useCart } from "@/components/site/CartProvider";
import { formatDateTime, formatINR, formatTime } from "@/lib/format";

type TrackedOrder = {
  id: number;
  orderCode: string;
  status: string;
  statusLabel: string;
  orderType: string;
  total: number;
  paymentStatus: string;
  paymentMethod: string;
  itemCount: number;
  eta: string;
  tableCode: string | null;
  createdAt: string;
  customerName: string;
};

type Detail = {
  order: TrackedOrder;
  items: { id: number; name: string; variantName: string | null; quantity: number; lineTotal: number; notes: string | null }[];
  history: { id: number; status: string; note: string | null; createdAt: string }[];
  tracker: { flow: { key: string; label: string }[]; currentIndex: number };
  cancellable: boolean;
  support: { phone: string; callLink: string; whatsapp: string };
  error?: string;
};

export default function TrackOrderPage() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const { toast } = useCart();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      const data = (await response.json()) as Detail;
      if (!response.ok) throw new Error(data.error ?? "We could not load that order.");
      setDetail(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "We could not load that order.");
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    void load();
    // Live updates via SSE with a polling fallback
    let source: EventSource | null = null;
    const interval = setInterval(() => void load(), 15000);
    try {
      source = new EventSource(`/api/stream?orderId=${orderId}`);
      source.addEventListener("order", () => void load());
    } catch {
      source = null;
    }
    return () => {
      clearInterval(interval);
      source?.close();
    };
  }, [load, orderId]);

  const cancelOrder = async () => {
    setCancelling(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: "Cancelled by customer" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "We could not cancel this order.");
      toast("Order cancelled", "info");
      await load();
    } catch (cancelError) {
      toast(cancelError instanceof Error ? cancelError.message : "We could not cancel this order.", "error");
    } finally {
      setCancelling(false);
    }
  };

  if (error) {
    return (
      <div className="container-page py-20 text-center">
        <p className="font-display text-2xl">{error}</p>
        <Link href="/track" className="btn btn-primary mt-5">
          Track another order
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="container-page py-16">
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  const { order, tracker, history, items } = detail;
  const cancelled = ["cancelled", "rejected"].includes(order.status);

  return (
    <div className="container-page py-10">
      <p className="label">Track your order</p>
      <h1 className="font-display text-3xl">Order #{order.orderCode}</h1>
      <p className="mt-2 text-sm text-ink/60">
        {order.orderType.toUpperCase()} {order.tableCode ? `· Table ${order.tableCode}` : ""} · {formatDateTime(order.createdAt)} ·{" "}
        {formatINR(order.total)} · {order.paymentMethod.toUpperCase()} {order.paymentStatus.replace(/_/g, " ")}
      </p>
      <p className="mt-2 text-sm font-semibold text-ember">{order.eta}</p>

      {cancelled ? (
        <p className="mt-4 rounded-2xl bg-[#fdecea] p-4 text-sm text-[#a12622]">
          This order was {order.status}. If you paid online, a refund workflow has been raised where applicable.
        </p>
      ) : (
        <ol className="mt-8 space-y-4">
          {tracker.flow.map((step, index) => {
            const done = tracker.currentIndex >= index && tracker.currentIndex !== -1;
            const current = tracker.currentIndex === index;
            const timestamp = history.find((entry) => entry.status === step.key)?.createdAt;
            return (
              <li key={step.key} className="flex gap-4">
                <span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-[#23663a] text-white" : "border border-ink/20 text-ink/40"}`}>
                  {done ? "✓" : index + 1}
                </span>
                <div>
                  <p className={`font-medium ${current ? "text-ember" : ""}`}>
                    {current ? "● " : ""}
                    {step.label}
                  </p>
                  {timestamp ? <p className="text-xs text-ink/50">{formatTime(timestamp)}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-xl">Items</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between border-b border-ink/8 pb-2">
                <span>
                  {item.quantity} × {item.name}
                  {item.variantName ? ` (${item.variantName})` : ""}
                  {item.notes ? <span className="block text-xs italic text-ink/50">{item.notes}</span> : null}
                </span>
                <span>{formatINR(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          {detail.cancellable ? (
            <button type="button" className="btn btn-outline mt-4 text-[#a12622]" onClick={cancelOrder} disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Cancel order"}
            </button>
          ) : (
            <p className="mt-4 text-xs text-ink/50">
              Cancellation may no longer be available because your order is already being prepared.
            </p>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-display text-xl">Need help with this order?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={detail.support.callLink} className="btn btn-primary">
              Call Restaurant
            </a>
            <a href={detail.support.whatsapp} target="_blank" rel="noreferrer" className="btn btn-outline">
              WhatsApp Restaurant
            </a>
            <Link href="/account/support" className="btn btn-outline">
              Report an issue
            </Link>
          </div>
          <h3 className="mt-6 font-display text-lg">Status history</h3>
          <ul className="mt-2 space-y-1 text-xs text-ink/60">
            {history.map((entry) => (
              <li key={entry.id}>
                {formatTime(entry.createdAt)} — {entry.status.replace(/_/g, " ")}
                {entry.note ? ` · ${entry.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
