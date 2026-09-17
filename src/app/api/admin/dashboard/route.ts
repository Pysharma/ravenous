import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems, notifications, orders, reservations, users } from "@/db/schema";
import { jsonOk, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { openState, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  return route(async () => {
    await requireAdmin("orders.view");
    const today = startOfToday();
    const settings = await getSettings();

    const [statusCounts, todayAgg, refundRows, customerCount, reservationRows, lowStock, adminNotifications, recent] = await Promise.all([
      db.select({ status: orders.status, count: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
      db
        .select({
          orders: sql<number>`count(*)::int`,
          revenue: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
        })
        .from(orders)
        .where(and(gte(orders.createdAt, today), sql`${orders.status} not in ('cancelled','rejected')`)),
      db
        .select({ status: orders.refundStatus, count: sql<number>`count(*)::int`, amount: sql<number>`coalesce(sum(${orders.total}),0)::int` })
        .from(orders)
        .where(sql`${orders.refundStatus} is not null`)
        .groupBy(orders.refundStatus),
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reservations)
        .where(inArray(reservations.status, ["requested", "confirmed"])),
      db.select().from(inventoryItems).where(sql`${inventoryItems.currentStock} <= ${inventoryItems.lowStockThreshold}`),
      db
        .select()
        .from(notifications)
        .where(and(eq(notifications.audience, "admin"), eq(notifications.isRead, false)))
        .orderBy(desc(notifications.createdAt))
        .limit(12),
      db.select().from(orders).orderBy(desc(orders.createdAt)).limit(12),
    ]);

    const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s.count]));
    const paidToday = await db
      .select({ amount: sql<number>`coalesce(sum(${orders.total}),0)::int` })
      .from(orders)
      .where(and(gte(orders.createdAt, today), inArray(orders.paymentStatus, ["paid", "cod_collected"])));
    const state = openState(settings);

    return jsonOk({
      counts,
      today: {
        orders: todayAgg[0]?.orders ?? 0,
        revenue: todayAgg[0]?.revenue ?? 0,
        collected: paidToday[0]?.amount ?? 0,
        averageOrderValue: todayAgg[0]?.orders ? Math.round((todayAgg[0]?.revenue ?? 0) / todayAgg[0].orders) : 0,
      },
      refunds: refundRows,
      customers: customerCount[0]?.count ?? 0,
      reservationsUpcoming: reservationRows[0]?.count ?? 0,
      lowStock: lowStock.map((item) => ({ id: item.id, name: item.name, stock: item.currentStock, unit: item.unit, threshold: item.lowStockThreshold })),
      notifications: adminNotifications,
      recentOrders: recent,
      restaurant: {
        status: settings.status,
        statusMessage: state.bannerMessage ?? null,
        open: state.open,
        acceptOrders: state.acceptOrders,
        busyExtraMinutes: settings.busyExtraMinutes,
      },
    });
  }, "admin.dashboard");
}
