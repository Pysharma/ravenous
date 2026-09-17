import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { favorites, menuItems } from "@/db/schema";
import { bad, jsonOk, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { attachMenuDetails } from "@/lib/menu";

export const dynamic = "force-dynamic";

export async function GET() {
  return route(async () => {
    const user = await getCurrentUser();
    if (!user) return jsonOk({ favorites: [], ids: [] });
    const rows = await db.select().from(favorites).where(eq(favorites.userId, user.id));
    const ids = rows.map((r) => r.menuItemId);
    if (!ids.length) return jsonOk({ favorites: [], ids: [] });
    const items = await db.select().from(menuItems).where(and(eq(menuItems.isAvailable, true)));
    const detailed = await attachMenuDetails(items.filter((item) => ids.includes(item.id)));
    return jsonOk({ ids, favorites: detailed });
  }, "favorites.list");
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await getCurrentUser();
    if (!user) bad("Please sign in to save favourites.");
    const body = (await request.json().catch(() => ({}))) as { menuItemId?: number; action?: string };
    const menuItemId = Number(body.menuItemId);
    if (!menuItemId) bad("Dish is required.");
    const existing = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, user.id), eq(favorites.menuItemId, menuItemId)))
      .limit(1);
    if (existing.length) {
      await db.delete(favorites).where(eq(favorites.id, existing[0].id));
      return jsonOk({ favorite: false });
    }
    await db.insert(favorites).values({ userId: user.id, menuItemId }).onConflictDoNothing();
    return jsonOk({ favorite: true });
  }, "favorites.toggle");
}
