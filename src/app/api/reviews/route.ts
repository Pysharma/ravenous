import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { menuItems, orders, reviews } from "@/db/schema";
import { assertRateLimit, bad, clientIp, jsonOk, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notify";
import { getSettings, orderingSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return route(async () => {
    const url = new URL(request.url);
    const menuItemId = Number(url.searchParams.get("menuItemId") ?? 0);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 12), 50);
    const rows = await db
      .select()
      .from(reviews)
      .where(eq(reviews.status, "approved"))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
    const filtered = menuItemId ? rows.filter((r) => r.menuItemId === menuItemId) : rows;
    return jsonOk({ reviews: filtered });
  }, "reviews.list");
}

const schema = z.object({
  orderId: z.number().int().positive().nullable().optional(),
  menuItemId: z.number().int().positive().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().nullable(),
  comment: z.string().trim().min(4, "Please write a few words about your experience.").max(1200),
});

export async function POST(request: Request) {
  return route(async () => {
    assertRateLimit(`review:${clientIp(request)}`, 6, 60 * 60 * 1000, "You have submitted several reviews already. Please try later.");
    const user = await getCurrentUser();
    if (!user) bad("Please sign in to write a review.");
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) bad(parsed.error.issues[0]?.message ?? "Please check your review.");
    const data = parsed.data;
    const settings = await getSettings();
    const ordering = orderingSettings(settings);

    let verified = false;
    let menuItemId = data.menuItemId ?? null;
    if (data.orderId) {
      const [order] = await db.select().from(orders).where(eq(orders.id, data.orderId)).limit(1);
      if (!order || order.userId !== user.id) bad("We could not find that order on your account.");
      if (!["delivered", "completed", "picked_up"].includes(order.status)) {
        bad("You can review this order once it is delivered or completed.");
      }
      verified = true;
      menuItemId = menuItemId ?? null;
    } else if (menuItemId) {
      const [item] = await db.select().from(menuItems).where(eq(menuItems.id, menuItemId)).limit(1);
      if (!item) bad("We could not find that dish.");
    }

    const [created] = await db
      .insert(reviews)
      .values({
        orderId: data.orderId ?? null,
        menuItemId,
        userId: user.id,
        customerName: user.name,
        rating: data.rating,
        title: data.title ?? null,
        comment: data.comment,
        status: ordering.reviewsRequireApproval ? "pending" : "approved",
        isVerified: verified,
        isDemoData: false,
      })
      .returning();

    await notifyAdmins("New review submitted", `${user.name} rated ${data.rating}★`, "/admin/reviews", "review");
    return jsonOk({
      review: created,
      message: ordering.reviewsRequireApproval
        ? "Thanks! Your review will appear once the restaurant approves it."
        : "Thanks for the review!",
    });
  }, "reviews.create");
}
