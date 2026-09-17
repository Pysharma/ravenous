import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime, formatINR, formatTime } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { etaMessage, getOrderDetail, STATUS_FLOW, statusLabel } from "@/lib/orders";
import { telLink, whatsappLink, getSettings } from "@/lib/settings";
import type { OrderType } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const orderId = Number(id);
  if (!orderId) notFound();
  let detail;
  try {
    detail = await getOrderDetail(orderId);
  } catch {
    notFound();
  }
  if (detail.order.userId !== user.id) notFound();
  const { order, items, history, payments, refunds } = detail;
  const flow = STATUS_FLOW[(order.orderType as OrderType) ?? "delivery"];
  const currentIndex = flow.findIndex((step) => step.key === order.status);
  const settings = await getSettings();

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl">{order.orderCode}</p>
              <p className="text-xs text-ink/55">
                {formatDateTime(order.createdAt)} · {order.orderType} {order.tableCode ? `· Table ${order.tableCode}` : ""}
              </p>
            </div>
            <span className="badge badge-ember">{statusLabel(order.status)}</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-ember">{etaMessage(order)}</p>
          <ol className="mt-5 space-y-3">
            {flow.map((step, index) => {
              const done = currentIndex >= index && currentIndex !== -1;
              const time = history.find((entry) => entry.status === step.key)?.createdAt;
              return (
                <li key={step.key} className="flex items-center gap-3 text-sm">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${done ? "bg-[#23663a] text-white" : "border border-ink/20 text-ink/40"}`}>
                    {done ? "✓" : index + 1}
                  </span>
                  <span className={currentIndex === index ? "font-semibold text-ember" : "text-ink/75"}>{step.label}</span>
                  {time ? <span className="ml-auto text-xs text-ink/45">{formatTime(time)}</span> : null}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-xl">Items (saved at purchase price)</h2>
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
                  Unit {formatINR(item.unitPrice)}
                  {item.addons.length ? ` · Add-ons: ${item.addons.map((a) => `${a.name} (${formatINR(a.price)})`).join(", ")}` : ""}
                </p>
                {item.notes ? <p className="text-xs italic text-ink/50">{item.notes}</p> : null}
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
            {order.discountTotal > 0 ? <div className="flex justify-between text-[#23663a]"><dt>Discount {order.couponCode}</dt><dd>−{formatINR(order.discountTotal)}</dd></div> : null}
            <div className="flex justify-between"><dt>Taxes</dt><dd>{formatINR(order.taxTotal)}</dd></div>
            <div className="flex justify-between"><dt>Packaging</dt><dd>{formatINR(order.packagingFee)}</dd></div>
            <div className="flex justify-between"><dt>Delivery</dt><dd>{formatINR(order.deliveryFee)}</dd></div>
            <div className="flex justify-between font-display text-xl"><dt>Total</dt><dd>{formatINR(order.total)}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/account/orders/${order.id}/invoice`} className="btn btn-dark px-4 py-1.5 text-xs">
              Download Invoice
            </Link>
            <Link href={`/track/${order.id}`} className="btn btn-outline px-4 py-1.5 text-xs">
              Track
            </Link>
            <Link href="/menu" className="btn btn-outline px-4 py-1.5 text-xs">
              Order again
            </Link>
          </div>
        </div>

        {["delivered", "completed", "picked_up"].includes(order.status) ? <ReviewForm orderId={order.id} /> : null}
      </div>

      <div className="space-y-5">
        <div className="card p-5 text-sm">
          <h2 className="font-display text-xl">Order details</h2>
          <dl className="mt-3 space-y-2">
            <div>
              <dt className="text-ink/55">Customer</dt>
              <dd>
                {order.customerName}
                <br />
                {order.customerPhone}
                {order.customerEmail ? (
                  <>
                    <br />
                    {order.customerEmail}
                  </>
                ) : null}
              </dd>
            </div>
            {order.addressSnapshot ? (
              <div>
                <dt className="text-ink/55">Delivery address</dt>
                <dd>
                  {[(order.addressSnapshot as { house?: string }).house, (order.addressSnapshot as { street?: string }).street, (order.addressSnapshot as { locality?: string }).locality, (order.addressSnapshot as { city?: string }).city, (order.addressSnapshot as { pincode?: string }).pincode]
                    .filter(Boolean)
                    .join(", ")}
                  {order.distanceKm ? <span className="block text-xs text-ink/50">{Math.round(order.distanceKm / 100)} km from the restaurant</span> : null}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-ink/55">Payment</dt>
              <dd>
                {order.paymentMethod.toUpperCase()} · {order.paymentStatus.replace(/_/g, " ")}
                {order.paymentReference ? <span className="block text-xs text-ink/50">Ref: {order.paymentReference}</span> : null}
              </dd>
            </div>
            {order.customerNote ? (
              <div>
                <dt className="text-ink/55">Your note</dt>
                <dd>{order.customerNote}</dd>
              </div>
            ) : null}
            {payments.length ? (
              <div>
                <dt className="text-ink/55">Payments</dt>
                <dd className="space-y-1">
                  {payments.map((payment) => (
                    <span key={payment.id} className="block text-xs">
                      {payment.provider} · {payment.status} · {formatINR(payment.amount)}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {refunds.length ? (
              <div>
                <dt className="text-ink/55">Refunds</dt>
                <dd className="space-y-1">
                  {refunds.map((refund) => (
                    <span key={refund.id} className="block text-xs">
                      {refund.refundCode} · {refund.status} · {formatINR(refund.amount)}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="card p-5 text-sm">
          <h2 className="font-display text-xl">Need Help With This Order?</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={telLink(settings.phone)} className="btn btn-primary px-4 py-1.5 text-xs">
              Call Restaurant
            </a>
            <a href={whatsappLink(settings, `Hello Ravenous, I need help with order ${order.orderCode}.`)} target="_blank" rel="noreferrer" className="btn btn-outline px-4 py-1.5 text-xs">
              WhatsApp Restaurant
            </a>
          </div>
          <p className="mt-3 text-xs text-ink/50">{settings.name} · {settings.phone}</p>
        </div>
      </div>
    </div>
  );
}

function ReviewForm({ orderId }: { orderId: number }) {
  return (
    <form
      className="card p-5"
      action={async (formData: FormData) => {
        "use server";
        const rating = Number(formData.get("rating") ?? 5);
        const comment = String(formData.get("comment") ?? "");
        const { db } = await import("@/db");
        const { reviews } = await import("@/db/schema");
        const { requireUser } = await import("@/lib/auth");
        const { getSettings, orderingSettings } = await import("@/lib/settings");
        const user = await requireUser();
        const settings = await getSettings();
        await db.insert(reviews).values({
          orderId,
          userId: user.id,
          customerName: user.name,
          rating,
          comment,
          status: orderingSettings(settings).reviewsRequireApproval ? "pending" : "approved",
          isVerified: true,
        });
      }}
    >
      <h2 className="font-display text-xl">Rate this order</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
        <div>
          <label className="label" htmlFor="rating">
            Rating
          </label>
          <select id="rating" name="rating" className="select" defaultValue="5">
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} ★
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="comment">
            Review
          </label>
          <textarea id="comment" name="comment" className="textarea" rows={3} required minLength={4} placeholder="How was your food and service?" />
        </div>
      </div>
      <button type="submit" className="btn btn-primary mt-4">
        Submit review
      </button>
    </form>
  );
}
