import { sql } from "drizzle-orm";
import { db } from "@/db";
import { jsonOk, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Range = { from: Date; to: Date };

function resolveRange(url: URL): Range {
  const preset = url.searchParams.get("preset") ?? "monthly";
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  switch (preset) {
    case "daily":
      break;
    case "weekly":
      from.setDate(from.getDate() - 6);
      break;
    case "monthly":
      from.setDate(from.getDate() - 29);
      break;
    case "custom": {
      const start = url.searchParams.get("from");
      const end = url.searchParams.get("to");
      if (start) from.setTime(new Date(start).getTime());
      if (end) to.setTime(new Date(`${end}T23:59:59`).getTime());
      break;
    }
    default:
      from.setDate(from.getDate() - 29);
  }
  return { from, to };
}

export async function GET(request: Request) {
  return route(async () => {
    await requireAdmin("reports.view");
    const url = new URL(request.url);
    const { from, to } = resolveRange(url);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const validOrders = sql`status not in ('cancelled','rejected')`;

    const [salesByDay, topDishes, categorySales, byType, byPayment, customerGrowth, statusBreakdown, peakHours, discountTotals, deliveryRevenue, refundTotals, kpis] =
      await Promise.all([
        db.execute(sql`select to_char(created_at, 'YYYY-MM-DD') as day, count(*)::int as orders,
            coalesce(sum(total),0)::int as revenue, coalesce(sum(discount_total),0)::int as discounts
          from orders where created_at between ${fromIso} and ${toIso} and ${validOrders}
          group by 1 order by 1 asc`),
        db.execute(sql`select oi.name, sum(oi.quantity)::int as quantity, coalesce(sum(oi.line_total),0)::int as revenue
          from order_items oi join orders o on o.id = oi.order_id
          where o.created_at between ${fromIso} and ${toIso} and o.${validOrders}
          group by 1 order by quantity desc limit 10`),
        db.execute(sql`select coalesce(c.name, 'Uncategorised') as category, sum(oi.quantity)::int as quantity, coalesce(sum(oi.line_total),0)::int as revenue
          from order_items oi join orders o on o.id = oi.order_id
          left join menu_items mi on mi.id = oi.menu_item_id
          left join categories c on c.id = mi.category_id
          where o.created_at between ${fromIso} and ${toIso} and o.${validOrders}
          group by 1 order by revenue desc limit 10`),
        db.execute(sql`select order_type as label, count(*)::int as count, coalesce(sum(total),0)::int as revenue
          from orders where created_at between ${fromIso} and ${toIso} and ${validOrders} group by 1`),
        db.execute(sql`select payment_method as label, count(*)::int as count, coalesce(sum(total),0)::int as revenue
          from orders where created_at between ${fromIso} and ${toIso} and ${validOrders} group by 1`),
        db.execute(sql`select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as customers
          from users where created_at between ${fromIso} and ${toIso} group by 1 order by 1 asc`),
        db.execute(sql`select status, count(*)::int as count from orders
          where created_at between ${fromIso} and ${toIso} group by 1 order by count desc`),
        db.execute(sql`select extract(hour from created_at)::int as hour, count(*)::int as orders
          from orders where created_at between ${fromIso} and ${toIso} group by 1 order by 1 asc`),
        db.execute(sql`select coalesce(sum(discount_total),0)::int as discounts, coalesce(sum(coupon_code is not null)::int,0) as coupon_orders
          from orders where created_at between ${fromIso} and ${toIso} and ${validOrders}`),
        db.execute(sql`select coalesce(sum(delivery_fee),0)::int as delivery_fees, coalesce(sum(packaging_fee),0)::int as packaging_fees,
            coalesce(sum(tax_total),0)::int as taxes from orders where created_at between ${fromIso} and ${toIso} and ${validOrders}`),
        db.execute(sql`select status, count(*)::int as count, coalesce(sum(amount),0)::int as amount from refunds
          where created_at between ${fromIso} and ${toIso} group by 1`),
        db.execute(sql`select count(*)::int as orders, coalesce(sum(total),0)::int as revenue,
            coalesce(avg(total),0)::int as average_order_value,
            coalesce(sum(case when status in ('cancelled','rejected') then 1 else 0 end)::int,0) as cancelled,
            coalesce(sum(case when payment_status in ('paid','cod_collected') then 1 else 0 end)::int,0) as paid_orders
          from orders where created_at between ${fromIso} and ${toIso}`),
      ]);

    const rows = <T,>(result: { rows: unknown[] }) => result.rows as T[];

    return jsonOk({
      range: { from: fromIso, to: toIso, preset: url.searchParams.get("preset") ?? "monthly" },
      salesByDay: rows<{ day: string; orders: number; revenue: number; discounts: number }>(salesByDay),
      topDishes: rows<{ name: string; quantity: number; revenue: number }>(topDishes),
      categorySales: rows<{ category: string; quantity: number; revenue: number }>(categorySales),
      orderTypeBreakdown: rows<{ label: string; count: number; revenue: number }>(byType),
      paymentBreakdown: rows<{ label: string; count: number; revenue: number }>(byPayment),
      customerGrowth: rows<{ day: string; customers: number }>(customerGrowth),
      statusBreakdown: rows<{ status: string; count: number }>(statusBreakdown),
      peakHours: rows<{ hour: number; orders: number }>(peakHours),
      discounts: rows<{ discounts: number; coupon_orders: number }>(discountTotals)[0] ?? { discounts: 0, coupon_orders: 0 },
      fees: rows<{ delivery_fees: number; packaging_fees: number; taxes: number }>(deliveryRevenue)[0] ?? { delivery_fees: 0, packaging_fees: 0, taxes: 0 },
      refunds: rows<{ status: string; count: number; amount: number }>(refundTotals),
      kpis: rows<{ orders: number; revenue: number; average_order_value: number; cancelled: number; paid_orders: number }>(kpis)[0] ?? {
        orders: 0,
        revenue: 0,
        average_order_value: 0,
        cancelled: 0,
        paid_orders: 0,
      },
    });
  }, "admin.reports");
}
