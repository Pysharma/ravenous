import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { jsonOk, route } from "@/lib/api";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return route(async () => {
    const url = new URL(request.url);
    const audienceParam = url.searchParams.get("audience");
    const user = await getCurrentUser();
    const admin = await getCurrentAdmin();

    if (audienceParam === "admin") {
      if (!admin) return jsonOk({ notifications: [], unread: 0 });
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.audience, "admin"))
        .orderBy(desc(notifications.createdAt))
        .limit(30);
      return jsonOk({ notifications: rows, unread: rows.filter((r) => !r.isRead).length });
    }

    if (!user) {
      if (admin) {
        const rows = await db
          .select()
          .from(notifications)
          .where(eq(notifications.audience, "admin"))
          .orderBy(desc(notifications.createdAt))
          .limit(30);
        return jsonOk({ notifications: rows, unread: rows.filter((r) => !r.isRead).length });
      }
      return jsonOk({ notifications: [], unread: 0 });
    }
    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.audience, "customer"), eq(notifications.userId, user.id)))
      .orderBy(desc(notifications.createdAt))
      .limit(40);
    return jsonOk({ notifications: rows, unread: rows.filter((r) => !r.isRead).length });
  }, "notifications.list");
}

export async function PATCH(request: Request) {
  return route(async () => {
    const body = (await request.json().catch(() => ({}))) as { ids?: number[]; all?: boolean; audience?: string };
    const user = await getCurrentUser();
    const admin = await getCurrentAdmin();
    const audience = body.audience === "admin" ? "admin" : "customer";
    if (audience === "admin" && !admin) return jsonOk({ updated: 0 });
    if (audience === "customer" && !user) return jsonOk({ updated: 0 });
    if (body.all) {
      if (audience === "admin") {
        await db.update(notifications).set({ isRead: true }).where(eq(notifications.audience, "admin"));
      } else {
        await db
          .update(notifications)
          .set({ isRead: true })
          .where(and(eq(notifications.audience, "customer"), eq(notifications.userId, user!.id)));
      }
      return jsonOk({ updated: "all" });
    }
    if (body.ids?.length) {
      await db.update(notifications).set({ isRead: true }).where(inArray(notifications.id, body.ids));
    }
    return jsonOk({ updated: body.ids?.length ?? 0 });
  }, "notifications.read");
}
