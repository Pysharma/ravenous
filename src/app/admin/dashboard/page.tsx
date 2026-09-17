import Link from "next/link";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems, orders, reservations, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatINR, relativeTime } from "@/lib/format";
import { OrdersBoard } from "@/components/admin/AdminPanels";
import { getSettings, openState } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin("orders.view");
  const settings = await getSettings();
  const state = openState(settings);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [statusCounts, todayAgg, collected, customers, upcomingReservations, lowStock, recent] = await Promise.all([
    db.select({ status: orders.status, count: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
    db
      .select({ orders: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(${orders.total}),0)::int` })
      .from(orders)
      .where(and(gte(orders.createdAt, today), sql`${orders.status} not in ('cancelled','rejected')`)),
    db
      .select({ amount: sql<number>`coalesce(sum(${orders.total}),0)::int` })
      .from(orders)
      .where(and(gte(orders.createdAt, today), inArray(orders.paymentStatus, ["paid", "cod_collected"]))),
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db.select({ count: sql<number>`count(*)::int` }).from(reservations).where(inArray(reservations.status, ["requested", "confirmed"])),
    db.select().from(inventoryItems).where(sql`${inventoryItems.currentStock} <= ${inventoryItems.lowStockThreshold}`),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
  ]);

  const counts = Object.fromEntries(statusCounts.map((row) => [row.status, row.count]));
  const refunds = await db
    .select({ count: sql<number>`count(*)::int`, amount: sql<number>`coalesce(sum(${orders.total}),0)::int` })
    .from(orders)
    .where(sql`${orders.refundStatus} is not null`);

  const cards = [
    { label: "Today's orders", value: todayAgg[0]?.orders ?? 0, href: "/admin/orders" },
    { label: "Pending orders", value: counts.placed ?? 0, href: "/admin/orders" },
    { label: "Preparing", value: counts.preparing ?? 0, href: "/admin/kitchen" },
    { label: "Ready", value: (counts.ready ?? 0) + (counts.ready_for_pickup ?? 0), href: "/admin/kitchen" },
    { label: "Out for delivery", value: counts.out_for_delivery ?? 0, href: "/admin/orders" },
    { label: "Completed today", value: (counts.completed ?? 0) + (counts.delivered ?? 0), href: "/admin/reports" },
    { label: "Revenue today", value: formatINR(todayAgg[0]?.revenue ?? 0), href: "/admin/reports" },
    { label: "Collected today", value: formatINR(collected[0]?.amount ?? 0), href: "/admin/reports" },
    { label: "Refunds", value: `${refunds[0]?.count ?? 0} · ${formatINR(refunds[0]?.amount ?? 0)}`, href: "/admin/refunds" },
    { label: "Customers", value: customers[0]?.count ?? 0, href: "/admin/customers" },
    { label: "Upcoming reservations", value: upcomingReservations[0]?.count ?? 0, href: "/admin/reservations" },
    { label: "Low stock items", value: lowStock.length, href: "/admin/inventory" },
  ];

  return (
    <div className="space-y-6">
      <section className="card-dark p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="badge badge-gold">Restaurant status: {settings.status.replace(/_/g, " ")}</p>
            <h2 className="mt-2 font-display text-2xl text-cream">
              {state.open ? "Open and accepting orders" : state.acceptOrders ? "Open" : "Orders disabled"}
            </h2>
            <p className="text-sm text-cream/70">
              {state.bannerMessage ?? `Today ${settings.phone} · Delivery ${settings.delivery?.enabled ? "enabled" : "disabled"}`}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Link href="/admin/menu" className="btn btn-gold px-4 py-1.5 text-xs">
              + Add Dish
            </Link>
            <Link href="/admin/orders" className="btn btn-outline !border-cream/30 !text-cream px-4 py-1.5 text-xs">
              View Orders
            </Link>
            <Link href="/admin/kitchen" className="btn btn-outline !border-cream/30 !text-cream px-4 py-1.5 text-xs">
              Kitchen
            </Link>
            <Link href="/admin/coupons" className="btn btn-outline !border-cream/30 !text-cream px-4 py-1.5 text-xs">
              Add Offer
            </Link>
            <Link href="/admin/media" className="btn btn-outline !border-cream/30 !text-cream px-4 py-1.5 text-xs">
              Upload Image
            </Link>
            <Link href="/admin/settings" className="btn btn-outline !border-cream/30 !text-cream px-4 py-1.5 text-xs">
              Delivery Settings
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="card p-4 transition hover:-translate-y-0.5">
            <p className="label">{card.label}</p>
            <p className="font-display text-2xl">{card.value}</p>
          </Link>
        ))}
      </section>

      {(counts.placed ?? 0) > 0 ? (
        <p className="rounded-2xl bg-[#fdecea] p-3 text-sm font-semibold text-[#a12622]">
          🔴 {counts.placed} new order{counts.placed === 1 ? "" : "s"} waiting for acceptance ·{" "}
          <Link href="/admin/kitchen" className="underline">
            open the kitchen board
          </Link>
        </p>
      ) : null}

      <section>
        <h2 className="font-display text-2xl">Live orders</h2>
        <div className="mt-3">
          <OrdersBoard />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-xl">Low stock alerts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {lowStock.map((item) => (
              <li key={item.id} className="flex justify-between border-b border-ink/8 pb-1">
                <span>{item.name}</span>
                <span className="text-[#a12622]">
                  {item.currentStock} {item.unit} (alert ≤ {item.lowStockThreshold})
                </span>
              </li>
            ))}
            {!lowStock.length ? <li className="text-ink/55">All ingredients are above their thresholds.</li> : null}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-display text-xl">Latest orders</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recent.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-2 border-b border-ink/8 pb-1">
                <Link href={`/admin/orders/${order.id}`} className="underline">
                  {order.orderCode}
                </Link>
                <span className="text-xs text-ink/55">
                  {order.customerName} · {formatINR(order.total)} · {relativeTime(order.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
