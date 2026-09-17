import { db } from "@/db";
import { notificationLogs, notifications } from "@/db/schema";
import type { Order, OrderItem, OrderItemAddon } from "@/db/schema";
import { formatINR, formatDateTime } from "@/lib/format";
import { fullAddress, getSettings } from "@/lib/settings";

export type NotificationPayload = {
  audience?: "customer" | "admin";
  userId?: number | null;
  orderId?: number | null;
  type?: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

export async function pushNotification(payload: NotificationPayload) {
  try {
    await db.insert(notifications).values({
      audience: payload.audience ?? "customer",
      userId: payload.userId ?? null,
      orderId: payload.orderId ?? null,
      type: payload.type ?? "info",
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
    });
  } catch (error) {
    console.error("notification insert failed", error);
  }
}

export async function notifyAdmins(title: string, body?: string, link?: string, type = "order") {
  await pushNotification({ audience: "admin", title, body, link, type });
  await dispatch("email", process.env.ADMIN_EMAIL || "admin@ravenous.example", "admin_alert", { title, body, link });
}

async function logChannel(channel: string, recipient: string, template: string, payload: Record<string, unknown>, status: string, error?: string) {
  try {
    await db.insert(notificationLogs).values({ channel, recipient, template, payload, status, error: error ?? null });
  } catch (logError) {
    console.error("notification log failed", logError);
  }
}

async function dispatch(channel: string, recipient: string, template: string, payload: Record<string, unknown>) {
  try {
    if (channel === "email" && process.env.EMAIL_API_KEY && recipient) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Ravenous <onboarding@resend.dev>",
          to: [recipient],
          subject: String(payload.subject ?? payload.title ?? "Ravenous update"),
          html: String(payload.html ?? `<p>${payload.body ?? ""}</p>`),
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        await logChannel(channel, recipient, template, payload, "failed", text.slice(0, 400));
        return;
      }
      await logChannel(channel, recipient, template, payload, "sent");
      return;
    }
    await logChannel(channel, recipient, template, payload, "queued");
  } catch (error) {
    await logChannel(channel, recipient, template, payload, "failed", error instanceof Error ? error.message : "unknown");
  }
}

export async function sendEmail(to: string | null | undefined, subject: string, html: string, template = "generic") {
  if (!to) return;
  await dispatch("email", to, template, { subject, html });
}

export async function sendSms(to: string | null | undefined, body: string, template = "generic") {
  if (!to) return;
  if (process.env.SMS_API_KEY) {
    await dispatch("sms", to, template, { body });
    return;
  }
  await logChannel("sms", to, template, { body }, "queued");
}

export async function sendWhatsapp(to: string | null | undefined, body: string, template = "generic") {
  if (!to) return;
  if (process.env.WHATSAPP_API_KEY) {
    await dispatch("whatsapp", to, template, { body });
    return;
  }
  await logChannel("whatsapp", to, template, { body }, "queued");
}

export function integrationStatus() {
  return {
    email: Boolean(process.env.EMAIL_API_KEY),
    sms: Boolean(process.env.SMS_API_KEY),
    whatsapp: Boolean(process.env.WHATSAPP_API_KEY),
    razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    maps: Boolean(process.env.MAPS_API_KEY),
    storage: Boolean(process.env.STORAGE_API_KEY),
  };
}

export function orderEmailHtml(
  order: Order,
  items: (OrderItem & { addons?: OrderItemAddon[] })[],
  heading = "New Order — Ravenous",
): string {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${item.quantity} × ${item.name}${
          item.variantName ? ` (${item.variantName})` : ""
        }${item.addons?.length ? `<br/><small>+ ${item.addons.map((a) => a.name).join(", ")}</small>` : ""}${
          item.notes ? `<br/><small>Note: ${item.notes}</small>` : ""
        }</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatINR(item.lineTotal)}</td>
      </tr>`,
    )
    .join("");
  return `<div style="font-family:system-ui,Segoe UI,sans-serif;color:#20130c">
    <h2 style="margin:0 0 4px">${heading}</h2>
    <p style="margin:0 0 12px;color:#6b5a51">${formatDateTime(order.createdAt)}</p>
    <h3 style="margin:12px 0 6px">Order</h3>
    <p style="margin:0"><strong>${order.orderCode}</strong> · ${order.orderType} · ${order.status}</p>
    <h3 style="margin:12px 0 6px">Customer</h3>
    <p style="margin:0">${order.customerName}<br/>${order.customerPhone}${
      order.customerEmail ? `<br/>${order.customerEmail}` : ""
    }</p>
    ${
      order.orderType === "dinein"
        ? `<p style="margin:6px 0">Table: ${order.tableCode ?? "—"}</p>`
        : order.addressSnapshot
          ? `<p style="margin:6px 0">${JSON.stringify(order.addressSnapshot)}</p>`
          : ""
    }
    <table style="border-collapse:collapse;width:100%;margin-top:12px">${rows}</table>
    <table style="border-collapse:collapse;width:100%;margin-top:12px">
      <tr><td>Subtotal</td><td style="text-align:right">${formatINR(order.subtotal)}</td></tr>
      <tr><td>Discount</td><td style="text-align:right">-${formatINR(order.discountTotal)}</td></tr>
      <tr><td>Tax</td><td style="text-align:right">${formatINR(order.taxTotal)}</td></tr>
      <tr><td>Packaging</td><td style="text-align:right">${formatINR(order.packagingFee)}</td></tr>
      <tr><td>Delivery</td><td style="text-align:right">${formatINR(order.deliveryFee)}</td></tr>
      <tr><td style="font-weight:700">Total</td><td style="text-align:right;font-weight:700">${formatINR(order.total)}</td></tr>
    </table>
    <p style="margin-top:12px;color:#6b5a51">Payment: ${order.paymentMethod.toUpperCase()} · ${order.paymentStatus}</p>
  </div>`;
}

export async function notifyNewOrder(order: Order, items: (OrderItem & { addons?: OrderItemAddon[] })[]) {
  const settings = await getSettings();
  await notifyAdmins(
    `New order ${order.orderCode}`,
    `${order.customerName} · ${formatINR(order.total)} · ${order.orderType}`,
    `/admin/orders/${order.id}`,
  );
  await sendEmail(
    process.env.ADMIN_EMAIL || settings.email,
    `New Order — Ravenous (${order.orderCode})`,
    orderEmailHtml(order, items),
    "new_order_admin",
  );
  await sendEmail(
    order.customerEmail,
    `Order received — ${order.orderCode}`,
    orderEmailHtml(order, items, "Order received 🎉"),
    "new_order_customer",
  );
  await sendSms(order.customerPhone, `Ravenous: order ${order.orderCode} received. Total ${formatINR(order.total)}.`);
  await sendWhatsapp(
    settings.whatsapp,
    `New order ${order.orderCode} from ${order.customerName} — ${formatINR(order.total)}`,
  );
}

export const CUSTOMER_STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  payment_confirmed: { title: "Payment confirmed", body: "We have received your payment." },
  accepted: { title: "Order accepted", body: "Ravenous has accepted your order." },
  preparing: { title: "Order preparing", body: "Our kitchen is preparing your food." },
  ready: { title: "Order ready", body: "Your order is ready." },
  out_for_delivery: { title: "Out for delivery", body: "Your order is on the way." },
  delivered: { title: "Order delivered", body: "Enjoy your meal! Please share a review." },
  ready_for_pickup: { title: "Ready for pickup", body: "Your order is ready for pickup." },
  picked_up: { title: "Order picked up", body: "Thanks for visiting Ravenous." },
  served: { title: "Order served", body: "Your food has been served. Enjoy!" },
  bill_requested: { title: "Bill requested", body: "Our staff is preparing your bill." },
  completed: { title: "Order completed", body: "Thank you for dining with Ravenous." },
  cancelled: { title: "Order cancelled", body: "Your order has been cancelled." },
  rejected: { title: "Order rejected", body: "Unfortunately the restaurant could not accept this order." },
  refund_pending: { title: "Refund pending", body: "A refund has been raised for your order." },
  refund_initiated: { title: "Refund initiated", body: "Your refund is being processed." },
  refunded: { title: "Refund completed", body: "Your refund has been processed." },
};

export function supportHelpText(settingsName: string, orderCode: string, address: string) {
  return `${settingsName}\nOrder ${orderCode}\n${address}`;
}

export { fullAddress };
