import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { assertRateLimit, bad, clientIp, jsonOk, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { createGatewayOrder, markPaymentFailed, markPaymentPaid, paymentMode, razorpayConfigured, verifyCheckoutSignature } from "@/lib/payments";
import { getSettings, paymentSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const createSchema = z.object({ action: z.literal("create"), orderId: z.number().int().positive() });
const verifySchema = z.object({
  action: z.literal("verify"),
  orderId: z.number().int().positive(),
  razorpayPaymentId: z.string().min(3),
  razorpayOrderId: z.string().min(3),
  razorpaySignature: z.string().min(3),
});

export async function POST(request: Request) {
  return route(async () => {
    assertRateLimit(`payment:${clientIp(request)}`, 40, 10 * 60 * 1000, "Too many payment attempts. Please wait.");
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const user = await getCurrentUser();
    const settings = await getSettings();
    const payment = paymentSettings(settings);

    if (body.action === "create") {
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) bad("Invalid payment request.");
      const [order] = await db.select().from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1);
      if (!order) bad("Order not found.");
      if (!user || order.userId !== user.id) bad("This order does not belong to your account.");
      if (order.paymentStatus === "paid") return jsonOk({ alreadyPaid: true, mode: paymentMode() });
      if (!payment.onlineEnabled) bad("Online payment is currently disabled. Please choose another payment method.");

      const gateway = await createGatewayOrder({
        amountPaise: order.total,
        receipt: order.orderCode,
        notes: { orderCode: order.orderCode, customer: order.customerName },
      });
      const rows = await db.select().from(payments).where(eq(payments.orderId, order.id));
      if (rows[0]) {
        await db
          .update(payments)
          .set({ gatewayOrderId: gateway.gatewayOrderId, status: "pending", updatedAt: new Date() })
          .where(eq(payments.id, rows[0].id));
      } else {
        await db.insert(payments).values({
          orderId: order.id,
          provider: gateway.gateway ?? "razorpay",
          method: order.paymentMethod,
          amount: order.total,
          status: "pending",
          gatewayOrderId: gateway.gatewayOrderId,
        });
      }
      return jsonOk({
        gateway: gateway.gateway,
        keyId: gateway.keyId,
        gatewayOrderId: gateway.gatewayOrderId,
        amount: order.total,
        currency: "INR",
        orderCode: order.orderCode,
        mode: paymentMode(),
        configured: razorpayConfigured(),
        notice: gateway.notice,
      });
    }

    if (body.action === "verify") {
      const parsed = verifySchema.safeParse(body);
      if (!parsed.success) bad("Invalid payment confirmation.");
      const [order] = await db.select().from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1);
      if (!order) bad("Order not found.");
      /// Payment success is only accepted with a valid gateway signature.
      const valid = verifyCheckoutSignature({
        orderId: parsed.data.razorpayOrderId,
        paymentId: parsed.data.razorpayPaymentId,
        signature: parsed.data.razorpaySignature,
      });
      if (!valid) {
        await markPaymentFailed(order.id, "Signature verification failed");
        bad("We could not verify this payment. No money has been captured by Ravenous.");
      }
      await markPaymentPaid({
        orderId: order.id,
        gatewayPaymentId: parsed.data.razorpayPaymentId,
        gatewayOrderId: parsed.data.razorpayOrderId,
        signature: parsed.data.razorpaySignature,
      });
      return jsonOk({ verified: true });
    }

    if (body.action === "failure") {
      const orderId = Number((body as { orderId?: number }).orderId);
      if (orderId) await markPaymentFailed(orderId, String((body as { reason?: string }).reason ?? "Payment failed at gateway"));
      return jsonOk({ recorded: true });
    }

    return bad("Unsupported payment action.");
  }, "payments.create");
}
