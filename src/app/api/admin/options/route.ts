import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addons, adminUsers, categories, menuItems, restaurantTables, roles } from "@/db/schema";
import { jsonOk, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return route(async () => {
    await requireAdmin("orders.view");
    const [categoryRows, tableRows, roleRows, menuRows, addonRows, staffRows] = await Promise.all([
      db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder)),
      db.select({ id: restaurantTables.id, name: restaurantTables.tableNumber, code: restaurantTables.code }).from(restaurantTables).orderBy(asc(restaurantTables.id)),
      db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(asc(roles.id)),
      db.select({ id: menuItems.id, name: menuItems.name }).from(menuItems).orderBy(asc(menuItems.name)),
      db.select({ id: addons.id, name: addons.name, price: addons.price }).from(addons).orderBy(asc(addons.sortOrder)),
      db
        .select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, roleId: adminUsers.roleId })
        .from(adminUsers)
        .where(eq(adminUsers.status, "active")),
    ]);
    const driverRoleIds = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.slug, "delivery-staff"));
    const driverRoleId = driverRoleIds[0]?.id;
    return jsonOk({
      categories: categoryRows,
      tables: tableRows,
      roles: roleRows,
      menu: menuRows,
      addons: addonRows,
      drivers: staffRows.filter((s) => s.roleId === driverRoleId || true).map((s) => ({ id: s.id, name: `${s.name} (${s.email})` })),
    });
  }, "admin.options");
}
