import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  couponRedemptions,
  coupons,
  deliveryAssignments,
  menuItems,
  orderItemAddons,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  refunds,
  restaurantTables,
  type Order,
  type OrderItem,
  type OrderItemAddon,
} from "@/db/schema";
import { bad, notFound, writeAudit } from "@/lib/api";
import { formatINR, formatTime } from "@/lib/format";
import {
  CUSTOMER_STATUS_MESSAGES,
  notifyAdmins,
  notifyNewOrder,
  orderEmailHtml,
  pushNotification,
  sendEmail,
  sendSms,
} from "@/lib/notify";
import { priceCart, resolveEtaMinutes, type CartInputLine, type OrderType } from "@/lib/pricing";
import { deliverySettings, getSettings, openState, orderingSettings } from "@/lib/settings";

export const ORDER_STATUSES = [
  "placed",
  "payment_pending",
  "payment_confirmed",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "ready_for_pickup",
  "picked_up",
  "served",
  "bill_requested",
  "completed",
  "cancelled",
  "rejected",
  "refund_pending",
  "refund_initiated",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const REJECTION_REASONS = [
  "Restaurant busy",
  "Item unavailable",
  "Delivery unavailable",
  "Kitchen closed",
  "Technical problem",
  "Other",
];

export const STATUS_LABELS: Record<string, string> = {
  placed: "Order Placed",
  payment_pending: "Payment Pending",
  payment_confirmed: "Payment Confirmed",
  accepted: "Order Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  ready_for_pickup: "Ready for Pickup",
  picked_up: "Picked Up",
  served: "Served",
  bill_requested: "Bill Requested",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  refund_pending: "Refund Pending",
  refund_initiated: "Refund Initiated",
  refunded: "Refunded",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export const STATUS_FLOW: Record<OrderType, { key: string; label: string }[]> = {
  delivery: [
    { key: "placed", label: "Order Placed" },
    { key: "accepted", label: "Order Accepted" },
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: "Ready" },
    { key: "out_for_delivery", label: "Out for Delivery" },
    { key: "delivered", label: "Delivered" },
  ],
  pickup: [
    { key: "placed", label: "Order Placed" },
    { key: "accepted", label: "Order Accepted" },
    { key: "preparing", label: "Preparing" },
    { key: "ready_for_pickup", label: "Ready for Pickup" },
    { key: "picked_up", label: "Picked Up" },
    { key: "completed", label: "Completed" },
  ],
  dinein: [
    { key: "placed", label: "Order Placed" },
    { key: "accepted", label: "Accepted" },
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: "Ready" },
    { key: "served", label: "Served" },
    { key: "bill_requested", label: "Bill Requested" },
    { key: "completed", label: "Completed" },
  ],
};

export const KDS_COLUMNS = [
  { key: "new", label: "New", statuses: ["placed", "payment_pending", "payment_confirmed"] },
  { key: "accepted", label: "Accepted", statuses: ["accepted"] },
  { key: "preparing", label: "Preparing", statuses: ["preparing"] },
  { key: "ready", label: "Ready", statuses: ["ready", "ready_for_pickup", "served"] },
  { key: "completed", label: "Completed", statuses: ["out_for_delivery", "delivered", "picked_up", "bill_requested", "completed"] },
];

export function nextStatuses(order: Pick<Order, "orderType" | "status">): { key: string; label: string }[] {
  const flow = STATUS_FLOW[(order.orderType as OrderType) ?? "delivery"] ?? STATUS_FLOW.delivery;
  const index = flow.findIndex((s) => s.key === order.status);
  if (order.status === "placed" && order.orderType === "delivery") {
    return flow.slice(1);
  }
  if (index === -1) {
    return flow.filter((s) => ["accepted", "preparing", "ready", "completed", "delivered", "cancelled", "rejected"].includes(s.key));
  }
  return flow.slice(index + 1);
}

export async function generateOrderCode(at = new Date()): Promise<string> {
  const stamp = `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, "0")}${String(at.getDate()).padStart(2, "0")}`;
  const start = new Date(at);
  start.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(sql`${orders.createdAt} >= ${start.toISOString()}`);
  const next = (rows[0]?.count ?? 0) + 1;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `RV-${stamp}-${String(next + attempt).padStart(5, "0")}`;
    const existing = await db.select({ id: orders.id }).from(orders).where(eq(orders.orderCode, code)).limit(1);
    if (!existing.length) return code;
  }
  return `RV-${stamp}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;
}

export type CreateOrderInput = {
  userId?: number | null;
  lines: CartInputLine[];
  orderType: OrderType;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
    addressId?: number | null;
    addressSnapshot?: Record<string, unknown> | null;
    note?: string | null;
    deliveryInstructions?: string | null;
  };
  couponCode?: string | null;
  paymentMethod: string;
  distanceKm?: number | null;
  pincode?: string | null;
  scheduledFor?: Date | null;
  tableCode?: string | null;
  contactless?: boolean;
  isDemoData?: boolean;
};

export async function createOrder(input: CreateOrderInput) {
  const settings = await getSettings();
  const ordering = orderingSettings(settings);
  const delivery = deliverySettings(settings);
  const state = openState(settings);

  if (!state.acceptOrders && !input.scheduledFor) {
    bad(state.bannerMessage || "We're currently closed. You can schedule your order for later.");
  }
  if (input.orderType === "delivery" && !ordering.deliveryEnabled) bad("Delivery orders are currently disabled.");
  if (input.orderType === "pickup" && !ordering.pickupEnabled) bad("Pickup orders are currently disabled.");
  if (input.orderType === "dinein" && !ordering.dineInEnabled) bad("Dine-in ordering is currently disabled.");

  const cart = await priceCart({
    lines: input.lines,
    orderType: input.orderType,
    couponCode: input.couponCode ?? null,
    userId: input.userId ?? null,
    distanceKm: input.distanceKm ?? null,
    pincode: input.pincode ?? null,
  });

  if (cart.lines.some((l) => !l.isAvailable)) {
    bad(cart.issues[0] ?? "One of the items in your cart is currently unavailable.");
  }
  if (input.orderType === "delivery" && !cart.serviceable) {
    bad(cart.serviceMessage ?? "We're sorry, Ravenous currently doesn't deliver to this location.");
  }
  if (cart.belowMinimum) {
    bad(`Minimum order value is ${formatINR(cart.minOrderPaise)} for ${input.orderType}.`);
  }
  if (input.paymentMethod === "cod") {
    if (!delivery.codEnabled || !settings.payment?.codEnabled) bad("Cash on delivery is currently unavailable.");
    if (cart.total < (delivery.minOrderCod ?? 0)) {
      bad(`Cash on delivery is available for orders above ${formatINR(delivery.minOrderCod ?? 0)}.`);
    }
    if (delivery.maxOrderCod > 0 && cart.total > delivery.maxOrderCod) {
      bad(`Cash on delivery is limited to ${formatINR(delivery.maxOrderCod)}. Please choose an online payment.`);
    }
  }

  let tableId: number | null = null;
  if (input.orderType === "dinein" && input.tableCode) {
    const [table] = await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.code, input.tableCode))
      .limit(1);
    if (!table) bad("This table QR code is not valid.");
    tableId = table.id;
  }

  const prepTimeMinutes = cart.prepTimeMinutes + (settings.status === "busy" ? settings.busyExtraMinutes : 0);
  const etaMinutes = resolveEtaMinutes(input.orderType, cart.prepTimeMinutes, cart.distanceKm, settings.status === "busy" ? settings.busyExtraMinutes : 0);
  const orderCode = await generateOrderCode();
  const isPaidLater = ["cod", "counter", "cash"].includes(input.paymentMethod);
  const paymentStatus = input.paymentMethod === "cod" ? "cod_pending" : isPaidLater ? "pay_at_restaurant" : "pending";

  const created = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        orderCode,
        userId: input.userId ?? null,
        customerName: input.customer.name,
        customerPhone: input.customer.phone,
        customerEmail: input.customer.email ?? null,
        orderType: input.orderType,
        status: "placed",
        paymentStatus,
        paymentMethod: input.paymentMethod,
        addressId: input.customer.addressId ?? null,
        addressSnapshot: input.customer.addressSnapshot ?? null,
        latitude: input.customer.addressSnapshot?.latitude ? String(input.customer.addressSnapshot.latitude) : null,
        longitude: input.customer.addressSnapshot?.longitude ? String(input.customer.addressSnapshot.longitude) : null,
        distanceKm: Math.round((cart.distanceKm ?? 0) * 100),
        deliveryFee: cart.deliveryFee,
        packagingFee: cart.packagingFee,
        subtotal: cart.subtotal,
        discountTotal: cart.discountTotal,
        taxTotal: cart.taxTotal,
        deliveryTax: cart.deliveryTax,
        couponCode: cart.couponCode,
        couponId: cart.couponId,
        total: cart.total,
        itemCount: cart.itemCount,
        customerNote: [input.customer.note, input.customer.deliveryInstructions].filter(Boolean).join(" | ") || null,
        tableId,
        tableCode: input.orderType === "dinein" ? input.tableCode ?? null : null,
        prepTimeMinutes,
        etaMinutes,
        scheduledFor: input.scheduledFor ?? null,
        contactless: Boolean(input.contactless),
        isDemoData: Boolean(input.isDemoData),
      })
      .returning();

    for (const line of cart.lines) {
      const [inserted] = await tx
        .insert(orderItems)
        .values({
          orderId: order.id,
          menuItemId: line.menuItemId,
          variantId: line.variantId,
          name: line.name,
          variantName: line.variantName,
          foodType: line.foodType,
          unitPrice: line.unitPrice,
          mrp: line.mrp,
          quantity: line.quantity,
          addonsTotal: line.addonsTotal,
          taxRate: line.taxRate,
          taxAmount: Math.round((line.lineSubtotal * line.taxRate) / 100),
          lineTotal: line.lineSubtotal,
          notes: line.notes,
        })
        .returning();
      if (line.addons.length) {
        await tx.insert(orderItemAddons).values(
          line.addons.map((a) => ({
            orderItemId: inserted.id,
            addonId: a.addonId,
            name: a.name,
            price: a.price,
            quantity: a.quantity,
          })),
        );
      }
    }

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      status: "placed",
      note: "Order received by Ravenous",
      actorType: "customer",
      actorId: input.userId ?? null,
    });

    const [payment] = await tx
      .insert(payments)
      .values({
        orderId: order.id,
        provider: isPaidLater ? (input.paymentMethod === "cod" ? "cash" : "counter") : "razorpay",
        method: input.paymentMethod,
        amount: order.total,
        status: input.paymentMethod === "cod" ? "cod_pending" : isPaidLater ? "pay_at_restaurant" : "initiated",
      })
      .returning();

    if (cart.couponId && cart.couponCode) {
      await tx.insert(couponRedemptions).values({
        couponId: cart.couponId,
        userId: input.userId ?? null,
        orderId: order.id,
        discountAmount: cart.discountTotal,
      });
      await tx
        .update(coupons)
        .set({ usedCount: sql`${coupons.usedCount} + 1` })
        .where(eq(coupons.id, cart.couponId));
    }

    if (tableId) {
      await tx.update(restaurantTables).set({ status: "occupied" }).where(eq(restaurantTables.id, tableId));
    }

    return { order, payment };
  });

  const items = await getOrderItems(created.order.id);
  await notifyNewOrder(created.order, items);
  await pushNotification({
    audience: "customer",
    userId: input.userId ?? null,
    orderId: created.order.id,
    type: "order",
    title: `Order ${created.order.orderCode} placed`,
    body: `We received your order of ${formatINR(created.order.total)}.`,
    link: `/account/orders/${created.order.id}`,
  });

  return { order: created.order, payment: created.payment, cart, items };
}

export async function getOrderItems(orderId: number): Promise<(OrderItem & { addons: OrderItemAddon[] })[]> {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(orderItems.id);
  if (!items.length) return [];
  const addonRows = await db
    .select()
    .from(orderItemAddons)
    .where(inArray(orderItemAddons.orderItemId, items.map((i) => i.id)));
  return items.map((item) => ({ ...item, addons: addonRows.filter((a) => a.orderItemId === item.id) }));
}

export async function getOrderDetail(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) notFound("Order not found.");
  const [items, history, paymentRows] = await Promise.all([
    getOrderItems(order.id),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, order.id)).orderBy(orderStatusHistory.id),
    db.select().from(payments).where(eq(payments.orderId, order.id)),
  ]);
  const refundRows = await db.select().from(refunds).where(eq(refunds.orderId, order.id));
  return { order, items, history, payments: paymentRows, refunds: refundRows };
}

export async function updateOrderStatus(
  orderId: number,
  status: string,
  options: {
    actorType?: string;
    actorId?: number | null;
    actorName?: string | null;
    note?: string | null;
    reason?: string | null;
    driverId?: number | null;
    driverName?: string | null;
    collectCod?: boolean;
  } = {},
) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) notFound("Order not found.");
  if (!ORDER_STATUSES.includes(status as OrderStatus)) bad("Unknown order status.");

  const patch: Partial<typeof orders.$inferInsert> = { status, updatedAt: new Date() };
  if (status === "accepted") patch.acceptedAt = new Date();
  if (["ready", "ready_for_pickup", "served"].includes(status)) patch.readyAt = new Date();
  if (["delivered", "picked_up", "completed"].includes(status)) patch.completedAt = new Date();
  if (status === "cancelled" || status === "rejected") {
    patch.cancellationReason = options.reason ?? options.note ?? null;
    patch.rejectionReason = status === "rejected" ? options.reason ?? options.note ?? null : order.rejectionReason;
    patch.cancelledBy = options.actorType ?? "admin";
  }
  if (status === "payment_confirmed") patch.paymentStatus = order.paymentMethod === "cod" ? "cod_pending" : "paid";
  if (status === "delivered") {
    if (order.paymentMethod === "cod") {
      patch.paymentStatus = options.collectCod === false ? order.paymentStatus : "cod_collected";
      patch.codCollected = options.collectCod === false ? order.codCollected : true;
    }
  }
  if (options.driverId) {
    patch.driverId = options.driverId;
    patch.driverName = options.driverName ?? null;
  }

  const [updated] = await db.update(orders).set(patch).where(eq(orders.id, orderId)).returning();

  await db.insert(orderStatusHistory).values({
    orderId,
    status,
    note: options.note ?? null,
    actorType: options.actorType ?? "admin",
    actorId: options.actorId ?? null,
  });

  const message = CUSTOMER_STATUS_MESSAGES[status];
  if (message) {
    await pushNotification({
      audience: "customer",
      userId: order.userId,
      orderId,
      type: "order",
      title: `${message.title} · ${order.orderCode}`,
      body: message.body,
      link: `/account/orders/${orderId}`,
    });
    await sendSms(order.customerPhone, `Ravenous ${order.orderCode}: ${message.title}`);
  }

  if (status === "cancelled" || status === "rejected") {
    await notifyAdmins(
      `Order ${order.orderCode} ${status}`,
      `${order.customerName} · ${formatINR(order.total)}${options.reason ? ` · ${options.reason}` : ""}`,
      `/admin/orders/${orderId}`,
      "order",
    );
    if (order.paymentStatus === "paid" || order.paymentStatus === "cod_collected") {
      await db.update(orders).set({ refundStatus: "pending" }).where(eq(orders.id, orderId));
    }
    await db
      .update(payments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(payments.orderId, orderId), eq(payments.status, "initiated")));
  }

  if (status === "delivered" || status === "completed") {
    const items = await getOrderItems(orderId);
    await sendEmail(
      order.customerEmail,
      `Your Ravenous order ${order.orderCode} is ${status === "delivered" ? "delivered" : "complete"}`,
      orderEmailHtml(updated, items, "Thanks for ordering from Ravenous"),
      "order_update_customer",
    );
  }

  if (options.driverId && order.orderType === "delivery") {
    await db.insert(deliveryAssignments).values({
      orderId,
      driverId: options.driverId,
      assignedByAdminId: options.actorId ?? null,
      status: "assigned",
    });
  }

  const tableStatusByOrderStatus: Record<string, string> = {
    preparing: "occupied",
    ready: "occupied",
    served: "occupied",
    bill_requested: "occupied",
    completed: "available",
    cancelled: "available",
  };
  if (order.tableId && tableStatusByOrderStatus[status]) {
    await db
      .update(restaurantTables)
      .set({ status: tableStatusByOrderStatus[status] })
      .where(eq(restaurantTables.id, order.tableId));
  }

  return updated;
}

export async function customerCancelOrder(orderId: number, userId: number, reason?: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) notFound("Order not found.");
  if (order.userId !== userId) bad("This order does not belong to your account.");
  const settings = await getSettings();
  const ordering = orderingSettings(settings);
  const blocked = ["preparing", "ready", "ready_for_pickup", "out_for_delivery", "delivered", "picked_up", "served", "completed", "cancelled", "rejected"];
  if (blocked.includes(order.status) && !ordering.allowCancelAfterPrep) {
    bad("Cancellation may no longer be available because your order is already being prepared.");
  }
  const windowMs = Math.max(ordering.cancellationWindowMinutes ?? 10, 0) * 60000;
  if (order.status !== "placed" && Date.now() - order.createdAt.getTime() > windowMs && !ordering.allowCancelAfterPrep) {
    bad("The cancellation window for this order has closed.");
  }
  return updateOrderStatus(orderId, "cancelled", {
    actorType: "customer",
    actorId: userId,
    note: reason ?? "Cancelled by customer",
    reason: reason ?? "Cancelled by customer",
  });
}

export async function initiateRefund(input: {
  orderId: number;
  amount: number;
  reason: string;
  adminId: number;
  method?: string;
  notes?: string | null;
}) {
  const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) notFound("Order not found.");
  const [payment] = await db.select().from(payments).where(eq(payments.orderId, order.id)).limit(1);
  const code = `RF-${new Date().getFullYear()}-${String(order.id).padStart(4, "0")}`;
  const [refund] = await db
    .insert(refunds)
    .values({
      refundCode: code,
      orderId: order.id,
      paymentId: payment?.id ?? null,
      userId: order.userId,
      amount: input.amount,
      reason: input.reason,
      method: input.method ?? "original",
      status: "pending",
      notes: input.notes ?? null,
      processedByAdminId: input.adminId,
    })
    .returning();
  await db.update(orders).set({ refundStatus: "pending", status: "refund_pending" }).where(eq(orders.id, order.id));
  await pushNotification({
    audience: "customer",
    userId: order.userId,
    orderId: order.id,
    type: "refund",
    title: `Refund pending · ${order.orderCode}`,
    body: `A refund of ${formatINR(input.amount)} has been raised.`,
    link: `/account/orders/${order.id}`,
  });
  await writeAudit({
    adminId: input.adminId,
    action: "refund.initiated",
    entity: "refunds",
    entityId: refund.id,
    summary: `Refund ${code} raised for ${order.orderCode} (${formatINR(input.amount)})`,
  });
  return refund;
}

export async function reorderForUser(orderId: number, userId: number) {
  const { order, items } = await getOrderDetail(orderId);
  if (order.userId !== userId) bad("This order does not belong to your account.");
  const available: CartInputLine[] = [];
  const unavailable: string[] = [];
  for (const item of items) {
    if (!item.menuItemId) {
      unavailable.push(item.name);
      continue;
    }
    const [live] = await db.select().from(menuItems).where(eq(menuItems.id, item.menuItemId)).limit(1);
    if (!live || !live.isAvailable || live.deletedAt) {
      unavailable.push(item.name);
      continue;
    }
    available.push({
      menuItemId: live.id,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
      addonIds: item.addons.map((a) => a.addonId).filter((id): id is number => Boolean(id)),
      notes: item.notes,
    });
  }
  return { lines: available, unavailable };
}

export function trackerSteps(order: Order) {
  const flow = STATUS_FLOW[(order.orderType as OrderType) ?? "delivery"] ?? STATUS_FLOW.delivery;
  const historyMap = new Map<string, Date>();
  return { flow, historyMap };
}

export function etaMessage(order: Order): string {
  if (order.status === "out_for_delivery") return `Arriving in approximately ${order.etaMinutes} minutes`;
  if (order.orderType === "delivery") return `Estimated arrival in approximately ${order.etaMinutes} minutes`;
  if (order.orderType === "pickup") return `Ready in approximately ${order.prepTimeMinutes} minutes`;
  return `Estimated serving time ${order.prepTimeMinutes} minutes`;
}

export function orderTimeLabel(order: Order): string {
  return formatTime(order.createdAt);
}

export async function recentOrdersForAdmin(limit = 50) {
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
}
