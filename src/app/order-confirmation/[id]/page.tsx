import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime, formatINR } from "@/lib/format";
import { etaMessage, getOrderDetail, statusLabel } from "@/lib/orders";
import { fullAddress, getSettings, telLink, whatsappLink } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!orderId) notFound();
  const settings = await getSettings();
  let detail;
  try {
    detail = await getOrderDetail(orderId);
  } catch {
    notFound();
  }
  const { order, items } = detail;
  const paid = ["paid", "cod_collected"].includes(order.paymentStatus);

  return (
    <div className="container-page py-12">
      <div className="card mx-auto max-w-3xl p-6 sm:p-8">
        <p className="badge badge-veg">Order Placed Successfully 🎉</p>
        <h1 className="mt-3 font-display text-3xl">Your order has been received by Ravenous.</h1>
        <p className="mt-2 text-sm text-ink/65">
          {order.orderCode} · {formatDateTime(order.createdAt)} · {order.orderType === "dinein" ? `Table ${order.tableCode}` : order.orderType}
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="card p-4">
            <dt className="label">Order ID</dt>
            <dd className="font-display text-xl">{order.orderCode}</dd>
          </div>
          <div className="card p-4">
            <dt className="label">Order status</dt>
            <dd className="font-semibold">{statusLabel(order.status)}</dd>
          </div>
          <div className="card p-4">
            <dt className="label">Payment</dt>
            <dd className="font-semibold">
              {order.paymentMethod.toUpperCase()} · {order.paymentStatus.replace(/_/g, " ")}
              {paid ? "" : " (pending confirmation)"}
            </dd>
          </div>
          <div className="card p-4">
            <dt className="label">Estimated time</dt>
            <dd className="font-semibold">{etaMessage(order)}</dd>
          </div>
        </dl>

        <h2 className="mt-8 font-display text-xl">Items</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between border-b border-ink/8 pb-2">
              <span>
                {item.quantity} × {item.name}
                {item.variantName ? ` (${item.variantName})` : ""}
                {item.addons.length ? <span className="block text-xs text-ink/55">+ {item.addons.map((a) => a.name).join(", ")}</span> : null}
                {item.notes ? <span className="block text-xs italic text-ink/50">{item.notes}</span> : null}
              </span>
              <span>{formatINR(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
          {order.discountTotal > 0 ? <div className="flex justify-between text-[#23663a]"><dt>Discount {order.couponCode}</dt><dd>−{formatINR(order.discountTotal)}</dd></div> : null}
          <div className="flex justify-between"><dt>Taxes</dt><dd>{formatINR(order.taxTotal)}</dd></div>
          <div className="flex justify-between"><dt>Packaging</dt><dd>{formatINR(order.packagingFee)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{formatINR(order.deliveryFee)}</dd></div>
          <div className="flex justify-between font-display text-xl"><dt>Total</dt><dd>{formatINR(order.total)}</dd></div>
        </dl>

        {order.orderType === "delivery" && order.addressSnapshot ? (
          <p className="mt-5 text-sm text-ink/65">
            Delivering to: {(order.addressSnapshot as { fullName?: string }).fullName ?? order.customerName}, {[
              (order.addressSnapshot as { house?: string }).house,
              (order.addressSnapshot as { street?: string }).street,
              (order.addressSnapshot as { locality?: string }).locality,
              (order.addressSnapshot as { city?: string }).city,
              (order.addressSnapshot as { pincode?: string }).pincode,
            ].filter(Boolean).join(", ")}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={`/track/${order.id}`} className="btn btn-primary">
            Track your order
          </Link>
          <Link href="/menu" className="btn btn-outline">
            Order something else
          </Link>
          <a href={telLink(settings.phone)} className="btn btn-outline">
            Call Restaurant
          </a>
          <a href={whatsappLink(settings, `Hello Ravenous, I need help with order ${order.orderCode}.`)} className="btn btn-outline" target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </div>
        <p className="mt-4 text-xs text-ink/50">
          Need help? {settings.name} · {settings.phone} · {fullAddress(settings)}
        </p>
      </div>
    </div>
  );
}
