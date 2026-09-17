import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orders, supportTickets } from "@/db/schema";
import { assertRateLimit, bad, clientIp, jsonOk, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

const schema = z.object({
  orderId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(2, "Please enter your name."),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,15}$/, "Please enter a valid phone number."),
  category: z.enum(["missing_item", "wrong_item", "quality", "payment", "delivery", "other"]),
  message: z.string().trim().min(8, "Please describe the issue.").max(1500),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export async function GET() {
  return route(async () => {
    const user = await getCurrentUser();
    if (!user) return jsonOk({ tickets: [] });
    const rows = await db.select().from(supportTickets).where(eq(supportTickets.userId, user.id)).orderBy(desc(supportTickets.id));
    return jsonOk({ tickets: rows });
  }, "support.list");
}

export async function POST(request: Request) {
  return route(async () => {
    assertRateLimit(`support:${clientIp(request)}`, 8, 30 * 60 * 1000, "Too many support requests. Please call the restaurant.");
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) bad(parsed.error.issues[0]?.message ?? "Please check the support form.");
    const data = parsed.data;
    const user = await getCurrentUser();
    let orderId: number | null = data.orderId ?? null;
    if (orderId) {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) bad("We could not find that order.");
      if (user && order.userId && order.userId !== user.id) bad("That order does not belong to your account.");
    }
    const code = `TKT-${Math.floor(100000 + Math.random() * 899999)}`;
    const [created] = await db
      .insert(supportTickets)
      .values({
        code,
        orderId,
        userId: user?.id ?? null,
        name: data.name,
        phone: data.phone,
        category: data.category,
        message: data.message,
        priority: data.priority ?? (data.category === "payment" ? "high" : "normal"),
        status: "open",
      })
      .returning();
    await notifyAdmins(
      `Support ticket ${code}`,
      `${data.name} · ${data.category.replace("_", " ")}${orderId ? ` · order #${orderId}` : ""}`,
      "/admin/support-tickets",
      "support",
    );
    return jsonOk({ ticket: created, message: `Ticket ${code} created. Our team will contact you shortly.` });
  }, "support.create");
}
