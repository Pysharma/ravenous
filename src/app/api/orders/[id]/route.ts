import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { bad, jsonError, jsonOk, route } from "@/lib/api";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth";
import { customerCancelOrder, etaMessage, getOrderDetail, reorderForUser, STATUS_FLOW, statusLabel, updateOrderStatus } from "@/lib/orders";
import type { OrderType } from "@/lib/pricing";
import { orderingSettings, getSettings, telLink, whatsappLink } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return route(async () => {
    const orderId = Number(id);
    if (!orderId) bad("Invalid order.");
    const [user, admin] = await Promise.all([getCurrentUser(), getCurrentAdmin()]);
    const detail = await getOrderDetail(orderId);
    if (!admin && detail.order.userId !== user?.id) {
      return jsonError("You do not have access to this order.", 403);
    }
    const settings = await getSettings();
    const ordering = orderingSettings(settings);
    const flow = STATUS_FLOW[(detail.order.orderType as OrderType) ?? "delivery"];
    const currentIndex = flow.findIndex((step) => step.key === detail.order.status);
    const cancellable =
      detail.order.userId === user?.id &&
      ["placed", "payment_pending", "payment_confirmed"].includes(detail.order.status) &&
      Date.now() - detail.order.createdAt.getTime() <= Math.max(ordering.cancellationWindowMinutes, 0) * 60000;

    return jsonOk({
      order: {
        ...detail.order,
        statusLabel: statusLabel(detail.order.status),
        eta: etaMessage(detail.order),
      },
      items: detail.items,
      history: detail.history,
      payments: detail.payments.map((p) => ({
        id: p.id,
        provider: p.provider,
        method: p.method,
        status: p.status,
        amount: p.amount,
        gatewayPaymentId: p.gatewayPaymentId,
        createdAt: p.createdAt,
      })),
      refunds: detail.refunds,
      tracker: { flow, currentIndex },
      cancellable,
      support: {
        phone: settings.phone,
        callLink: telLink(settings.phone),
        whatsapp: whatsappLink(settings, `Hello Ravenous, I need help with order ${detail.order.orderCode}.`),
      },
    });
  }, "orders.detail");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return route(async () => {
    const orderId = Number(id);
    const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string };
    const action = body.action;
    if (action === "status") {
      const admin = await getCurrentAdmin();
      if (!admin) return jsonError("Admin sign-in required.", 401);
      const status = String((body as { status?: string }).status ?? "");
      if (!status) bad("Status is required.");
      if (!admin.isSuperAdmin && !admin.permissions.includes("orders.manage")) {
        return jsonError("You do not have permission to change order status.", 403);
      }
      await updateOrderStatus(orderId, status, {
        actorType: "admin",
        actorId: admin.id,
        actorName: admin.name,
        note: (body as { note?: string }).note ?? null,
        reason: body.reason ?? null,
      });
      return jsonOk({ updated: true });
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Please sign in to continue.", 401);

    if (action === "cancel") {
      await customerCancelOrder(orderId, user.id, body.reason);
      return jsonOk({ cancelled: true });
    }
    if (action === "request-bill") {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order || order.userId !== user.id) bad("This order does not belong to your account.");
      if (order.orderType !== "dinein") bad("Bill requests are only available for dine-in orders.");
      await updateOrderStatus(orderId, "bill_requested", {
        actorType: "customer",
        actorId: user.id,
        note: "Guest requested the bill",
      });
      return jsonOk({ requested: true });
    }
    if (action === "reorder") {
      const result = await reorderForUser(orderId, user.id);
      return jsonOk({ lines: result.lines, unavailable: result.unavailable });
    }
    return bad("Unsupported action.");
  }, "orders.patch");
}
