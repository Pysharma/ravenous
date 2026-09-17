import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems, menuItems, orders, refunds, reservations, users } from "@/db/schema";
import { bad, jsonError, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, toCsv, toRupees } from "@/lib/format";
import { statusLabel } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") ?? "orders";
  const permission = type === "menu" ? "menu.view" : type === "customers" ? "customers.view" : type === "refunds" ? "orders.refund" : "orders.view";
  let csv = "";
  try {
    await requireAdmin(permission);
  } catch {
    return jsonError("You do not have permission to export this data.", 403);
  }
  try {
    if (type === "orders") {
      const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5000);
      csv = toCsv(
        rows.map((o) => ({
          order_id: o.orderCode,
          date: formatDateTime(o.createdAt),
          customer: o.customerName,
          phone: o.customerPhone,
          type: o.orderType,
          status: statusLabel(o.status),
          payment_method: o.paymentMethod,
          payment_status: o.paymentStatus,
          items: o.itemCount,
          subtotal: toRupees(o.subtotal),
          discount: toRupees(o.discountTotal),
          tax: toRupees(o.taxTotal),
          packaging: toRupees(o.packagingFee),
          delivery: toRupees(o.deliveryFee),
          total: toRupees(o.total),
          coupon: o.couponCode ?? "",
          table: o.tableCode ?? "",
          driver: o.driverName ?? "",
        })),
      );
    } else if (type === "customers") {
      const rows = await db.select().from(users).orderBy(desc(users.id)).limit(5000);
      const spending = await db.execute(
        sql`select user_id, count(*)::int as orders, coalesce(sum(total),0)::int as spend, max(created_at) as last_order
            from orders where user_id is not null group by 1`,
      );
      const spendRows = spending.rows as { user_id: number; orders: number; spend: number; last_order: string }[];
      csv = toCsv(
        rows.map((u) => {
          const stat = spendRows.find((s) => Number(s.user_id) === u.id);
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone ?? "",
            status: u.status,
            orders: stat?.orders ?? 0,
            total_spent: toRupees(stat?.spend ?? 0),
            last_order: stat?.last_order ? formatDateTime(stat.last_order) : "",
            joined: formatDateTime(u.createdAt),
          };
        }),
      );
    } else if (type === "menu") {
      const rows = await db.select().from(menuItems).where(sql`${menuItems.deletedAt} is null`).limit(5000);
      csv = toCsv(
        rows.map((m) => ({
          name: m.name,
          slug: m.slug,
          cuisine: m.cuisine ?? "",
          food_type: m.foodType,
          base_price: toRupees(m.basePrice),
          mrp: toRupees(m.mrp),
          tax: m.taxRate,
          available: m.isAvailable ? "yes" : "no",
          bestseller: m.isBestseller ? "yes" : "no",
          demo_data: m.isDemoData ? "yes" : "no",
          prep_time: m.prepTimeMinutes,
        })),
      );
    } else if (type === "inventory") {
      const rows = await db.select().from(inventoryItems).limit(5000);
      csv = toCsv(
        rows.map((i) => ({
          name: i.name,
          unit: i.unit,
          stock: i.currentStock,
          low_stock_threshold: i.lowStockThreshold,
          cost_per_unit: toRupees(i.costPerUnit),
          supplier: i.supplier ?? "",
          active: i.isActive ? "yes" : "no",
        })),
      );
    } else if (type === "refunds") {
      const rows = await db.select().from(refunds).orderBy(desc(refunds.id)).limit(5000);
      csv = toCsv(
        rows.map((r) => ({
          refund_id: r.refundCode,
          order_id: r.orderId,
          amount: toRupees(r.amount),
          reason: r.reason ?? "",
          method: r.method,
          status: r.status,
          created: formatDateTime(r.createdAt),
          updated: formatDateTime(r.updatedAt),
        })),
      );
    } else if (type === "reservations") {
      const rows = await db.select().from(reservations).orderBy(desc(reservations.date)).limit(5000);
      csv = toCsv(
        rows.map((r) => ({
          code: r.code,
          guest: r.name,
          phone: r.phone,
          date: r.date,
          time: r.time,
          guests: r.guests,
          status: r.status,
          request: r.specialRequest ?? "",
        })),
      );
    } else {
      bad("Unknown export type.");
    }
  } catch (error) {
    console.error("export failed", error);
    return jsonError("Something went wrong while generating the export. Please try again.", 500);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv || "no data\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ravenous-${type}-${stamp}.csv"`,
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  return route(async () => {
    await requireAdmin("reports.view");
    if (body.status) {
      const rows = await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, body.status));
      return { count: rows[0]?.count ?? 0 };
    }
    return { ok: true };
  }, "admin.export.post");
}
