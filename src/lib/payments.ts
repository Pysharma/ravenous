import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { bad, writeAudit } from "@/lib/api";
import { getSettings, paymentSettings } from "@/lib/settings";
import { pushNotification } from "@/lib/notify";

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function paymentMode() {
  return process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live") ? "live" : "test";
}

export async function createGatewayOrder(input: { amountPaise: number; receipt: string; notes?: Record<string, string> }) {
  if (!razorpayConfigured()) {
    return {
      gateway: "offline" as const,
      gatewayOrderId: null,
      keyId: null,
      amount: input.amountPaise,
      currency: "INR",
      notice:
        "Online gateway keys are not configured yet. The order is recorded with payment Pending and the restaurant verifies the payment manually.",
    };
  }
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Payment gateway error: ${text.slice(0, 200)}`);
  }
  const data = (await response.json()) as { id: string; amount: number; currency: string };
  return {
    gateway: "razorpay" as const,
    gatewayOrderId: data.id,
    keyId: process.env.RAZORPAY_KEY_ID ?? null,
    amount: data.amount,
    currency: data.currency,
    notice: null,
  };
}

export function verifyCheckoutSignature(payload: { orderId: string; paymentId: string; signature: string }) {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${payload.orderId}|${payload.paymentId}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(payload.signature));
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function markPaymentPaid(input: {
  orderId: number;
  gatewayPaymentId?: string | null;
  gatewayOrderId?: string | null;
  signature?: string | null;
  provider?: string;
  raw?: Record<string, unknown>;
  adminId?: number | null;
  collectedAmount?: number;
}) {
  const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) bad("Order not found.");
  const existing = await db.select().from(payments).where(eq(payments.orderId, input.orderId));
  const patchPayment = {
    status: "successful",
    gatewayPaymentId: input.gatewayPaymentId ?? null,
    gatewayOrderId: input.gatewayOrderId ?? null,
    gatewaySignature: input.signature ?? null,
    provider: input.provider ?? "razorpay",
    rawPayload: input.raw ?? null,
    confirmedByAdminId: input.adminId ?? null,
    updatedAt: new Date(),
  };
  if (existing[0]) {
    await db.update(payments).set(patchPayment).where(eq(payments.id, existing[0].id));
  } else {
    await db.insert(payments).values({
      orderId: input.orderId,
      amount: input.collectedAmount ?? order.total,
      method: order.paymentMethod,
      ...patchPayment,
    });
  }
  await db
    .update(orders)
    .set({ paymentStatus: "paid", paymentReference: input.gatewayPaymentId ?? null, updatedAt: new Date() })
    .where(eq(orders.id, input.orderId));
  await pushNotification({
    audience: "customer",
    userId: order.userId,
    orderId: order.id,
    type: "payment",
    title: `Payment confirmed · ${order.orderCode}`,
    body: "We have received your payment.",
    link: `/account/orders/${order.id}`,
  });
  await writeAudit({
    adminId: input.adminId ?? null,
    action: "payment.confirmed",
    entity: "payments",
    entityId: order.id,
    summary: `Payment confirmed for ${order.orderCode}`,
    meta: { gatewayPaymentId: input.gatewayPaymentId ?? null, provider: input.provider ?? "razorpay" },
  });
  return { ok: true };
}

export async function markPaymentFailed(orderId: number, reason: string, raw?: Record<string, unknown>) {
  const rows = await db.select().from(payments).where(eq(payments.orderId, orderId));
  if (rows[0]) {
    await db
      .update(payments)
      .set({ status: "failed", failureReason: reason, rawPayload: raw ?? null, updatedAt: new Date() })
      .where(eq(payments.id, rows[0].id));
  }
  await db.update(orders).set({ paymentStatus: "failed", updatedAt: new Date() }).where(eq(orders.id, orderId));
}

export async function refundablePayment(orderId: number) {
  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "successful")))
    .limit(1);
  return rows[0] ?? null;
}

export function availablePaymentMethods() {
  return getSettings().then((settings) => {
    const payment = paymentSettings(settings);
    const methods: { id: string; label: string; description: string; enabled: boolean }[] = [
      { id: "upi", label: "UPI / Online payment", description: "Pay securely via Razorpay (UPI, card, net banking, wallet).", enabled: payment.onlineEnabled && payment.upiEnabled },
      { id: "razorpay", label: "Card / Net banking / Wallet", description: "Powered by Razorpay secure checkout.", enabled: payment.onlineEnabled && (payment.cardEnabled || payment.netbankingEnabled || payment.walletEnabled) },
      { id: "cod", label: "Cash on Delivery", description: "Pay the delivery partner in cash.", enabled: payment.codEnabled },
      { id: "counter", label: "Pay at restaurant", description: "Settle the bill at the counter or with your server.", enabled: payment.payAtRestaurant },
    ];
    return methods;
  });
}
