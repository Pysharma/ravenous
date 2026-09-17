import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, orders } from "@/db/schema";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth";
import { statusLabel } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = Number(url.searchParams.get("orderId") ?? 0);
  const user = await getCurrentUser();
  const admin = await getCurrentAdmin();

  if (!admin && !orderId) {
    return new Response("event: error\ndata: unauthorized\n\n", {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  if (orderId && !admin) {
    const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!rows[0] || rows[0].userId !== user?.id) {
      return new Response("event: error\ndata: forbidden\n\n", { status: 403, headers: { "Content-Type": "text/event-stream" } });
    }
  }

  const encoder = new TextEncoder();
  let lastPayload = "";
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        if (closed) return;
        try {
          if (orderId) {
            const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
            if (order) {
              const payload = {
                status: order.status,
                statusLabel: statusLabel(order.status),
                paymentStatus: order.paymentStatus,
                updatedAt: order.updatedAt,
              };
              const serialized = JSON.stringify(payload);
              if (serialized !== lastPayload) {
                lastPayload = serialized;
                send("order", payload);
              }
            }
          } else {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const [rows, counts, unread] = await Promise.all([
              db.select().from(orders).where(gte(orders.createdAt, since)).orderBy(desc(orders.createdAt)).limit(40),
              db
                .select({ status: orders.status, count: sql<number>`count(*)::int` })
                .from(orders)
                .where(gte(orders.createdAt, since))
                .groupBy(orders.status),
              db
                .select({ count: sql<number>`count(*)::int` })
                .from(notifications)
                .where(and(eq(notifications.audience, "admin"), eq(notifications.isRead, false))),
            ]);
            const payload = {
              counts: Object.fromEntries(counts.map((c) => [c.status, c.count])),
              unread: unread[0]?.count ?? 0,
              orders: rows.map((order) => ({
                id: order.id,
                orderCode: order.orderCode,
                status: order.status,
                statusLabel: statusLabel(order.status),
                orderType: order.orderType,
                total: order.total,
                customerName: order.customerName,
                tableCode: order.tableCode,
                createdAt: order.createdAt,
                paymentStatus: order.paymentStatus,
              })),
            };
            const serialized = JSON.stringify(payload);
            if (serialized !== lastPayload) {
              lastPayload = serialized;
              send("orders", payload);
            }
          }
        } catch (error) {
          console.error("stream poll error", error);
        }
      };

      send("hello", { ok: true, mode: orderId ? "order" : "admin" });
      await poll();
      const interval = setInterval(poll, 4000);
      const heartbeat = setInterval(() => send("ping", { t: Date.now() }), 15000);
      const timeout = setTimeout(() => {
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }, 10 * 60 * 1000);
      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
        clearTimeout(timeout);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}


