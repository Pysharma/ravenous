import { eq } from "drizzle-orm";
import { db } from "@/db";
import { restaurantTables } from "@/db/schema";
import { jsonError, jsonOk, route } from "@/lib/api";
import { listCategoriesWithCounts, listMenu } from "@/lib/menu";
import { getSettings, orderingSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return route(async () => {
    const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.code, code.toUpperCase())).limit(1);
    if (!table || !table.isActive) return jsonError("This table QR code is not valid. Please ask our staff for help.", 404);
    const settings = await getSettings();
    const ordering = orderingSettings(settings);
    const menu = await listMenu({ perPage: 60, sort: "recommended" });
    const categories = await listCategoriesWithCounts();
    return jsonOk({
      table: {
        id: table.id,
        code: table.code,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        section: table.section,
        status: table.status,
      },
      dineInEnabled: ordering.dineInEnabled && ordering.tableQrEnabled,
      restaurant: { name: settings.name, phone: settings.phone, whatsapp: settings.whatsapp },
      categories: categories.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl, itemCount: c.itemCount, prepTimeMinutes: c.prepTimeMinutes })),
      items: menu.items.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        categoryId: item.categoryId,
        imageUrl: item.imageUrl,
        basePrice: item.basePrice,
        mrp: item.mrp,
        foodType: item.foodType,
        isAvailable: item.isAvailable,
        prepTimeMinutes: item.prepTimeMinutes,
        shortDescription: item.shortDescription,
        hasCustomization: item.hasCustomization,
        variants: item.variants.map((v) => ({ id: v.id, name: v.name, price: v.price, isDefault: v.isDefault, isAvailable: v.isAvailable })),
        addons: item.addons.map((a) => ({ id: a.id, name: a.name, price: a.price })),
      })),
    });
  }, "tables.qr");
}
