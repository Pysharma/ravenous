import { notFound } from "next/navigation";
import { formatDateTime, formatINR } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getOrderDetail, statusLabel } from "@/lib/orders";
import { fullAddress, getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/site/PrintButton";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
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
  const settings = await getSettings();
  const { order, items } = detail;

  return (
    <div className="container-page py-10">
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <PrintButton />
      </div>
      <div className="print-page card mx-auto max-w-3xl p-8">
        <header className="border-b border-ink/15 pb-4">
          <h1 className="font-display text-2xl uppercase tracking-wide">{settings.name}</h1>
          <p className="text-sm text-ink/70">{fullAddress(settings)}</p>
          <p className="text-sm text-ink/70">
            Phone: {settings.phone}
            {settings.gstNumber ? ` · GSTIN: ${settings.gstNumber}` : ""}
            {settings.fssaiNumber ? ` · FSSAI: ${settings.fssaiNumber}` : ""}
          </p>
        </header>

        <section className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="label">Tax invoice</p>
            <p>Invoice no: INV-{order.orderCode.replace("RV-", "")}</p>
            <p>Order ID: {order.orderCode}</p>
            <p>Date: {formatDateTime(order.createdAt)}</p>
            <p>Status: {statusLabel(order.status)}</p>
          </div>
          <div>
            <p className="label">Billed to</p>
            <p>{order.customerName}</p>
            <p>{order.customerPhone}</p>
            {order.customerEmail ? <p>{order.customerEmail}</p> : null}
            {order.orderType === "dinein" ? (
              <p>Table: {order.tableCode}</p>
            ) : order.addressSnapshot ? (
              <p>
                {[(order.addressSnapshot as { house?: string }).house, (order.addressSnapshot as { street?: string }).street, (order.addressSnapshot as { locality?: string }).locality, (order.addressSnapshot as { city?: string }).city, (order.addressSnapshot as { pincode?: string }).pincode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink/20 text-left">
              <th className="py-2">Item</th>
              <th className="py-2">Qty</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-ink/10 align-top">
                <td className="py-2">
                  {item.name}
                  {item.variantName ? ` (${item.variantName})` : ""}
                  {item.addons.length ? <span className="block text-xs text-ink/60">+ {item.addons.map((a) => a.name).join(", ")}</span> : null}
                  {item.notes ? <span className="block text-xs italic text-ink/60">{item.notes}</span> : null}
                  <span className="block text-xs text-ink/50">GST {item.taxRate}%</span>
                </td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2 text-right">{formatINR(item.unitPrice + item.addonsTotal)}</td>
                <td className="py-2 text-right">{formatINR(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-5 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
          {order.discountTotal > 0 ? <div className="flex justify-between"><span>Discount {order.couponCode}</span><span>−{formatINR(order.discountTotal)}</span></div> : null}
          <div className="flex justify-between"><span>Taxes (GST)</span><span>{formatINR(order.taxTotal)}</span></div>
          <div className="flex justify-between"><span>Packaging</span><span>{formatINR(order.packagingFee)}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span>{formatINR(order.deliveryFee)}</span></div>
          <div className="flex justify-between border-t border-ink/20 pt-2 font-display text-lg"><span>Total</span><span>{formatINR(order.total)}</span></div>
          <div className="flex justify-between"><span>Payment method</span><span>{order.paymentMethod.toUpperCase()}</span></div>
          <div className="flex justify-between"><span>Payment status</span><span>{order.paymentStatus.replace(/_/g, " ")}</span></div>
        </section>

        <footer className="mt-8 border-t border-ink/15 pt-4 text-xs text-ink/60">
          <p>{settings.invoiceFooter}</p>
          <p className="mt-1">This is a computer generated invoice from the Ravenous ordering platform.</p>
        </footer>
      </div>
    </div>
  );
}
