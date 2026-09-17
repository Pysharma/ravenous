import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/api";
import { markPaymentFailed, markPaymentPaid, verifyWebhookSignature } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    console.warn("Rejected webhook with invalid signature");
    return jsonError("Invalid signature.", 401);
  }
  let payload: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string; error_description?: string } };
    };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonError("Invalid payload.", 400);
  }
  const entity = payload.payload?.payment?.entity;
  const gatewayOrderId = entity?.order_id;
  if (!gatewayOrderId) return jsonOk({ ignored: true });

  const paymentRows = await db.select().from(payments).where(eq(payments.gatewayOrderId, gatewayOrderId));
  const fallbackRows = paymentRows.length ? [] : await db.select().from(payments);
  const paymentMatch = paymentRows[0] ?? fallbackRows.find((p) => p.orderId && p.gatewayOrderId === gatewayOrderId);
  const target = paymentMatch
    ? (await db.select().from(orders).where(eq(orders.id, paymentMatch.orderId)).limit(1))[0]
    : undefined;

  if (!target) {
    // No matching local order: acknowledge so the gateway stops retrying.
    return jsonOk({ received: true, matched: false });
  }

  if (payload.event?.includes("paid") && entity?.id) {
    await markPaymentPaid({
      orderId: target.id,
      gatewayPaymentId: entity.id,
      gatewayOrderId,
      raw: payload as unknown as Record<string, unknown>,
      provider: "razorpay-webhook",
    });
    return jsonOk({ received: true, matched: true, status: "paid" });
  }

  if (payload.event?.includes("failed")) {
    await markPaymentFailed(target.id, entity?.error_description ?? payload.event, payload as unknown as Record<string, unknown>);
    return jsonOk({ received: true, matched: true, status: "failed" });
  }

  return jsonOk({ received: true, matched: true, status: "ignored" });
}
