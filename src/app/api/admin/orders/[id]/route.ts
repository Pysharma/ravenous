import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { bad, jsonOk, route, writeAudit } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { formatINR } from "@/lib/format";
import { markPaymentPaid } from "@/lib/payments";
import { etaMessage, getOrderDetail, initiateRefund, statusLabel, updateOrderStatus } from "@/lib/orders";
import { pushNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return route(async () => {
    await requireAdmin("orders.view");
    const detail = await getOrderDetail(Number(id));
    return jsonOk({ ...detail, statusLabel: statusLabel(detail.order.status), eta: etaMessage(detail.order) });
  }, "admin.orders.detail");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return route(async () => {
    const admin = await requireAdmin(["orders.manage", "orders.cancel", "orders.refund", "delivery.manage"]);
    const orderId = Number(id);
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      status?: string;
      note?: string | null;
      reason?: string | null;
      adminNote?: string | null;
      driverId?: number | null;
      driverName?: string | null;
      amount?: number;
      collectCod?: boolean;
    };
    const action = body.action ?? "status";

    if (action === "note") {
      await db.update(orders).set({ adminNote: body.adminNote ?? null, updatedAt: new Date() }).where(eq(orders.id, orderId));
      await writeAudit({ adminId: admin.id, actorName: admin.name, action: "orders.note", entity: "orders", entityId: orderId, summary: "Updated internal note" });
      return jsonOk({ updated: true });
    }

    if (action === "assign-driver") {
      if (!body.driverId) bad("Select a delivery staff member.");
      await updateOrderStatus(orderId, "out_for_delivery", {
        actorType: "admin",
        actorId: admin.id,
        actorName: admin.name,
        note: `Assigned to ${body.driverName ?? "delivery staff"}`,
        driverId: body.driverId,
        driverName: body.driverName ?? null,
      });
      await writeAudit({ adminId: admin.id, actorName: admin.name, action: "orders.driver_assigned", entity: "orders", entityId: orderId, summary: `Assigned driver ${body.driverName ?? body.driverId}` });
      return jsonOk({ assigned: true });
    }

    if (action === "confirm-payment") {
      await markPaymentPaid({ orderId, adminId: admin.id, provider: "manual-admin", collectedAmount: body.amount });
      await updateOrderStatus(orderId, "payment_confirmed", {
        actorType: "admin",
        actorId: admin.id,
        actorName: admin.name,
        note: "Payment verified by staff",
      });
      await writeAudit({ adminId: admin.id, actorName: admin.name, action: "payment.confirmed_manual", entity: "orders", entityId: orderId, summary: `Manually confirmed payment for order #${orderId}` });
      return jsonOk({ confirmed: true });
    }

    if (action === "collect-cod") {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) bad("Order not found.");
      await db.update(orders).set({ codCollected: true, paymentStatus: "cod_collected", updatedAt: new Date() }).where(eq(orders.id, orderId));
      await db.update(payments).set({ status: "cod_collected", updatedAt: new Date() }).where(eq(payments.orderId, orderId));
      await writeAudit({ adminId: admin.id, actorName: admin.name, action: "payment.cod_collected", entity: "orders", entityId: orderId, summary: `COD collected for ${order.orderCode}` });
      return jsonOk({ collected: true });
    }

    if (action === "refund") {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) bad("Order not found.");
      const amount = body.amount ?? order.total;
      if (amount <= 0) bad("Refund amount must be greater than zero.");
      const refund = await initiateRefund({
        orderId,
        amount,
        reason: body.reason ?? "Refund requested by staff",
        adminId: admin.id,
        notes: body.note ?? null,
      });
      await writeAudit({ adminId: admin.id, actorName: admin.name, action: "refund.initiated", entity: "refunds", entityId: refund.id, summary: `Refund of ${formatINR(amount)} for ${order.orderCode}` });
      return jsonOk({ refund });
    }

    if (action === "refund-complete") {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) bad("Order not found.");
      /// Only marked complete after the payment partner confirms the refund.
      await db.update(orders).set({ refundStatus: "completed", status: "refunded", updatedAt: new Date() }).where(eq(orders.id, orderId));
      await db.update(payments).set({ status: "refunded", updatedAt: new Date() }).where(eq(payments.orderId, orderId));
      await pushNotification({
        audience: "customer",
        userId: order.userId,
        orderId,
        type: "refund",
        title: `Refund completed · ${order.orderCode}`,
        body: `Your refund of ${formatINR(order.total)} has been processed.`,
        link: `/account/orders/${orderId}`,
      });
      await writeAudit({ adminId: admin.id, actorName: admin.name, action: "refund.completed", entity: "orders", entityId: orderId, summary: `Refund marked complete for ${order.orderCode}` });
      return jsonOk({ completed: true });
    }

    const status = String(body.status ?? "");
    if (!status) bad("Status is required.");
    if (["cancelled", "rejected"].includes(status) && !body.reason) {
      bad("Please select a reason for cancelling or rejecting this order.");
    }
    if (status === "rejected" && !admin.isSuperAdmin && !admin.permissions.includes("orders.cancel")) {
      bad("Your role cannot reject orders.");
    }
    const updated = await updateOrderStatus(orderId, status, {
      actorType: "admin",
      actorId: admin.id,
      actorName: admin.name,
      note: body.note ?? null,
      reason: body.reason ?? null,
      collectCod: body.collectCod,
    });
    await writeAudit({
      adminId: admin.id,
      actorName: admin.name,
      action: `orders.status_${status}`,
      entity: "orders",
      entityId: orderId,
      summary: `${admin.name} moved ${updated.orderCode} to ${statusLabel(status)}${body.reason ? ` (${body.reason})` : ""}`,
    });
    return jsonOk({ order: updated });
  }, "admin.orders.patch");
}
