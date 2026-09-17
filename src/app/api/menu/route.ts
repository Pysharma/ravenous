import { jsonOk, route } from "@/lib/api";
import { listMenu } from "@/lib/menu";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return route(async () => {
    const url = new URL(request.url);
    const num = (key: string) => {
      const raw = url.searchParams.get(key);
      if (!raw) return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    };
    const result = await listMenu({
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      foodType: url.searchParams.get("foodType") ?? undefined,
      minPrice: num("minPrice"),
      maxPrice: num("maxPrice"),
      spicy: url.searchParams.get("spicy") === "1",
      bestseller: url.searchParams.get("bestseller") === "1",
      popular: url.searchParams.get("popular") === "1",
      isNew: url.searchParams.get("new") === "1",
      featured: url.searchParams.get("featured") === "1",
      availableOnly: url.searchParams.get("available") === "1",
      sort: url.searchParams.get("sort") ?? undefined,
      page: num("page"),
      perPage: num("perPage"),
    });
    return jsonOk({
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      categories: result.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl })),
      items: result.items.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        categorySlug: item.categorySlug,
        cuisine: item.cuisine,
        shortDescription: item.shortDescription,
        description: item.description,
        ingredients: item.ingredients,
        allergens: item.allergens,
        imageUrl: item.imageUrl,
        basePrice: item.basePrice,
        mrp: item.mrp,
        taxRate: item.taxRate,
        foodType: item.foodType,
        spiceLevel: item.spiceLevel,
        prepTimeMinutes: item.prepTimeMinutes,
        servingSize: item.servingSize,
        isAvailable: item.isAvailable,
        isJain: item.isJain,
        isFeatured: item.isFeatured,
        isBestseller: item.isBestseller,
        isPopular: item.isPopular,
        isNew: item.isNew,
        isRecommended: item.isRecommended,
        hasCustomization: item.hasCustomization,
        ratingAvg: item.ratingAvg,
        ratingCount: item.ratingCount,
        tags: item.tags,
        isDemoData: item.isDemoData,
        variants: item.variants.map((v) => ({ id: v.id, name: v.name, price: v.price, mrp: v.mrp, isDefault: v.isDefault, isAvailable: v.isAvailable })),
        addons: item.addons.map((a) => ({ id: a.id, name: a.name, price: a.price, groupLabel: a.groupLabel })),
      })),
    });
  }, "menu.list");
}
