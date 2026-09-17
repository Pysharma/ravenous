import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  addons as addonsTable,
  categories,
  menuItemAddons,
  menuItems,
  menuVariants,
  reviews,
  type Addon,
  type Category,
  type MenuItem,
  type MenuVariant,
} from "@/db/schema";

export type MenuItemFull = MenuItem & {
  variants: MenuVariant[];
  addons: Addon[];
  categoryName: string | null;
  categorySlug: string | null;
};

export type MenuFilters = {
  q?: string;
  category?: string;
  foodType?: string;
  minPrice?: number;
  maxPrice?: number;
  spicy?: boolean;
  bestseller?: boolean;
  popular?: boolean;
  isNew?: boolean;
  availableOnly?: boolean;
  sort?: string;
  page?: number;
  perPage?: number;
  featured?: boolean;
};

export async function attachMenuDetails(items: MenuItem[]): Promise<MenuItemFull[]> {
  if (!items.length) return [];
  const ids = items.map((i) => i.id);
  const [variantRows, addonRows, categoryRows] = await Promise.all([
    db.select().from(menuVariants).where(inArray(menuVariants.menuItemId, ids)).orderBy(asc(menuVariants.sortOrder)),
    db
      .select({ addon: addonsTable, menuItemId: menuItemAddons.menuItemId })
      .from(menuItemAddons)
      .innerJoin(addonsTable, eq(addonsTable.id, menuItemAddons.addonId))
      .where(inArray(menuItemAddons.menuItemId, ids)),
    db.select().from(categories),
  ]);
  return items.map((item) => {
    const category = categoryRows.find((c) => c.id === item.categoryId);
    return {
      ...item,
      variants: variantRows.filter((v) => v.menuItemId === item.id),
      addons: addonRows.filter((r) => r.menuItemId === item.id).map((r) => r.addon),
      categoryName: category?.name ?? null,
      categorySlug: category?.slug ?? null,
    };
  });
}

export async function listMenu(filters: MenuFilters = {}) {
  const perPage = Math.min(Math.max(filters.perPage ?? 24, 1), 60);
  const page = Math.max(filters.page ?? 1, 1);
  const conditions = [sql`${menuItems.deletedAt} is null`];

  if (filters.q) {
    const term = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        ilike(menuItems.name, term),
        ilike(menuItems.description, term),
        ilike(menuItems.ingredients, term),
        ilike(menuItems.tags, term),
        ilike(menuItems.cuisine, term),
      )!,
    );
  }
  if (filters.category) {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, filters.category)).limit(1);
    if (!cat) return { items: [] as MenuItemFull[], total: 0, page, perPage, categories: await db.select().from(categories).orderBy(asc(categories.sortOrder)) };
    conditions.push(eq(menuItems.categoryId, cat.id));
  }
  if (filters.foodType && filters.foodType !== "all") conditions.push(eq(menuItems.foodType, filters.foodType));
  if (filters.minPrice) conditions.push(sql`${menuItems.basePrice} >= ${filters.minPrice}`);
  if (filters.maxPrice) conditions.push(sql`${menuItems.basePrice} <= ${filters.maxPrice}`);
  if (filters.spicy) conditions.push(inArray(menuItems.spiceLevel, ["spicy", "extra_spicy"]));
  if (filters.bestseller) conditions.push(eq(menuItems.isBestseller, true));
  if (filters.popular) conditions.push(eq(menuItems.isPopular, true));
  if (filters.isNew) conditions.push(eq(menuItems.isNew, true));
  if (filters.featured) conditions.push(eq(menuItems.isFeatured, true));
  if (filters.availableOnly) conditions.push(eq(menuItems.isAvailable, true));

  const where = and(...conditions);
  const orderBy = (() => {
    switch (filters.sort) {
      case "price_asc":
        return [asc(menuItems.basePrice)];
      case "price_desc":
        return [desc(menuItems.basePrice)];
      case "newest":
        return [desc(menuItems.createdAt)];
      case "rating":
        return [desc(menuItems.ratingAvg), desc(menuItems.ratingCount)];
      case "popular":
        return [desc(menuItems.isBestseller), desc(menuItems.isPopular), asc(menuItems.sortOrder)];
      default:
        return [desc(menuItems.isRecommended), desc(menuItems.isFeatured), asc(menuItems.sortOrder), asc(menuItems.id)];
    }
  })();

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(menuItems)
      .where(where)
      .orderBy(...orderBy)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ count: sql<number>`count(*)::int` }).from(menuItems).where(where),
  ]);

  return {
    items: await attachMenuDetails(rows),
    total: countRows[0]?.count ?? 0,
    page,
    perPage,
    categories: await db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
  };
}

export async function listCategoriesWithCounts() {
  const rows = await db
    .select({
      category: categories,
      count: sql<number>`count(${menuItems.id})::int`,
    })
    .from(categories)
    .leftJoin(menuItems, and(eq(menuItems.categoryId, categories.id), sql`${menuItems.deletedAt} is null`))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder));
  return rows.map((r) => ({ ...r.category, itemCount: r.count }));
}

export async function getMenuBySlug(slug: string): Promise<MenuItemFull | null> {
  const [item] = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.slug, slug), sql`${menuItems.deletedAt} is null`))
    .limit(1);
  if (!item) return null;
  const [full] = await attachMenuDetails([item]);
  return full;
}

export async function getRelatedItems(item: MenuItemFull, limit = 4) {
  if (!item.categoryId) return [];
  const rows = await db
    .select()
    .from(menuItems)
    .where(
      and(
        eq(menuItems.categoryId, item.categoryId),
        ne(menuItems.id, item.id),
        eq(menuItems.isAvailable, true),
        sql`${menuItems.deletedAt} is null`,
      ),
    )
    .orderBy(desc(menuItems.isBestseller), asc(menuItems.sortOrder))
    .limit(limit);
  return attachMenuDetails(rows);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const [cat] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return cat ?? null;
}

export async function approvedReviews(limit = 12) {
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.status, "approved"))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function wishlistIdsFor(userId: number | null | undefined) {
  if (!userId) return new Set<number>();
  const rows = await db.execute(sql`select menu_item_id from favorites where user_id = ${userId}`);
  const ids = (rows.rows as { menu_item_id: number }[]).map((r) => Number(r.menu_item_id));
  return new Set(ids);
}

export function itemImage(item: Pick<MenuItem, "imageUrl">, fallback = "/images/hero-dish.jpg") {
  return item.imageUrl || fallback;
}

export function effectivePrice(item: MenuItemFull) {
  if (item.variants.length) {
    const def = item.variants.find((v) => v.isDefault) ?? item.variants[0];
    return { price: def.price, mrp: Math.max(def.mrp, def.price), variantId: def.id };
  }
  return { price: item.basePrice, mrp: Math.max(item.mrp, item.basePrice), variantId: null };
}

export function isItemWithinSchedule(item: Pick<MenuItem, "availability">, at = new Date()) {
  const availability = item.availability;
  if (!availability || (!availability.startTime && !availability.days?.length)) return true;
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][at.getDay()];
  if (availability.days?.length && !availability.days.includes(dayName)) return false;
  if (availability.startTime && availability.endTime) {
    const toMin = (t: string) => Number(t.split(":")[0]) * 60 + Number(t.split(":")[1] ?? 0);
    const now = at.getHours() * 60 + at.getMinutes();
    const start = toMin(availability.startTime);
    const end = toMin(availability.endTime);
    return start <= end ? now >= start && now <= end : now >= start || now <= end;
  }
  return true;
}
