import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { etaMessage, getOrderDetail, statusLabel } from "@/lib/orders";
import { formatDateTime, formatINR, formatTime } from "@/lib/format";
import { telLink, whatsappLink, getSettings } from "@/lib/settings";
import { OrderActions } from "@/components/admin/AdminPanels";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("orders.view");
  const { id } = await params;
  const orderId = Number(id);
  if (!orderId) notFound();
  let detail;
  try {
    detail = await getOrderDetail(orderId);
  } catch {
    notFound();
  }
  const settings = await getSettings();
  const { order, items, history, payments, refunds } = detail;
  const snapshot = (order.addressSnapshot ?? {}) as Record<string, string | undefined>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="label">Order</p>
          <h1 className="font-display text-2xl">{order.orderCode}</h1>
          <p className="text-xs text-ink/55">
            {formatDateTime(order.createdAt)} · {order.orderType} {order.tableCode ? `· Table ${order.tableCode}` : ""} · {statusLabel(order.status)}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <a href={telLink(order.customerPhone)} className="btn btn-primary px-4 py-1.5 text-xs">
            Call Customer
          </a>
          <a
            href={whatsappLink(settings, `Hello ${order.customerName}, this is Ravenous regarding your order ${order.orderCode}.`)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-gold px-4 py-1.5 text-xs"
          >
            WhatsApp Customer
          </a>
          <Link href="/admin/orders" className="btn btn-outline px-4 py-1.5 text-xs">
            Back to orders
          </Link>
        </div>
      </div>

      <p className="rounded-2xl bg-cream-dark p-3 text-sm">⏱ {etaMessage(order)} · Preparation target {order.prepTimeMinutes} minutes</p>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-display text-xl">Items</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {items.map((item) => (
                <li key={item.id} className="border-b border-ink/8 pb-3">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {item.quantity} × {item.name}
                      {item.variantName ? ` (${item.variantName})` : ""}
                    </span>
                    <span>{formatINR(item.lineTotal)}</span>
                  </div>
                  <p className="text-xs text-ink/55">
                    Unit {formatINR(item.unitPrice)} · GST {item.taxRate}% · {item.foodType}
                  </p>
                  {item.addons.length ? <p className="text-xs text-ink/60">Add-ons: {item.addons.map((addon) => `${addon.name} (${formatINR(addon.price)})`).join(", ")}</p> : null}
                  {item.notes ? <p className="text-xs font-semibold text-[#93610c]">Special instructions: {item.notes}</p> : null}
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Discount {order.couponCode ?? ""}</dt><dd>−{formatINR(order.discountTotal)}</dd></div>
              <div className="flex justify-between"><dt>Tax</dt><dd>{formatINR(order.taxTotal)}</dd></div>
              <div className="flex justify-between"><dt>Packaging</dt><dd>{formatINR(order.packagingFee)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd>{formatINR(order.deliveryFee)}</dd></div>
              <div className="flex justify-between font-display text-lg"><dt>Total</dt><dd>{formatINR(order.total)}</dd></div>
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="font-display text-xl">Timeline</h2>
            <ul className="mt-3 space-y-1 text-xs text-ink/65">
              {history.map((entry) => (
                <li key={entry.id}>
                  {formatTime(entry.createdAt)} — {statusLabel(entry.status)} ({entry.actorType}){entry.note ? ` · ${entry.note}` : ""}
                </li>
              ))}
            </ul>
          </div>

          <OrderActions orderId={order.id} order={order as unknown as Record<string, unknown>} />
        </div>

        <div className="space-y-5">
          <div className="card p-5 text-sm">
            <h2 className="font-display text-xl">Customer</h2>
            <p className="mt-2 font-medium">{order.customerName}</p>
            <p>{order.customerPhone}</p>
            {order.customerEmail ? <p>{order.customerEmail}</p> : null}
            {order.customerNote ? <p className="mt-2 text-xs text-ink/60">Note: {order.customerNote}</p> : null}
          </div>

          <div className="card p-5 text-sm">
            <h2 className="font-display text-xl">{order.orderType === "delivery" ? "Delivery" : "Order type"}</h2>
            {order.orderType === "delivery" ? (
              <>
                <p className="mt-2">
                  {[snapshot.house, snapshot.street, snapshot.locality, snapshot.city, snapshot.pincode].filter(Boolean).join(", ") || "Address captured at checkout"}
                </p>
                <p className="mt-1 text-xs text-ink/55">
                  Distance {order.distanceKm ? `${Math.round(order.distanceKm / 100)} km` : "not measured"} · Fee {formatINR(order.deliveryFee)}
                  {order.contactless ? " · Contactless" : ""}
                </p>
                <p className="mt-1 text-xs text-ink/55">Driver: {order.driverName ?? "Not assigned"}</p>
              </>
            ) : (
              <p className="mt-2">{order.orderType === "pickup" ? "Customer collects from the restaurant" : `Table ${order.tableCode ?? "—"}`}</p>
            )}
          </div>

          <div className="card p-5 text-sm">
            <h2 className="font-display text-xl">Payment</h2>
            <p className="mt-2">
              {order.paymentMethod.toUpperCase()} · {order.paymentStatus.replace(/_/g, " ")}
            </p>
            {order.paymentReference ? <p className="text-xs text-ink/55">Reference: {order.paymentReference}</p> : null}
            <ul className="mt-2 space-y-1 text-xs text-ink/60">
              {payments.map((payment) => (
                <li key={payment.id}>
                  {payment.provider} · {payment.status} · {formatINR(payment.amount)}
                  {payment.gatewayPaymentId ? ` · ${payment.gatewayPaymentId}` : ""}
                </li>
              ))}
            </ul>
            {refunds.length ? (
              <div className="mt-3">
                <p className="label">Refunds</p>
                <ul className="space-y-1 text-xs">
                  {refunds.map((refund) => (
                    <li key={refund.id}>
                      {refund.refundCode} · {refund.status} · {formatINR(refund.amount)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
