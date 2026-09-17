import { jsonError, jsonOk, route } from "@/lib/api";
import { getMenuBySlug, getRelatedItems } from "@/lib/menu";
import { getSettings } from "@/lib/settings";
import { approvedReviews } from "@/lib/menu";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return route(async () => {
    const item = await getMenuBySlug(slug);
    if (!item) return jsonError("We couldn't find that dish.", 404);
    const [related, settings] = await Promise.all([getRelatedItems(item), getSettings()]);
    const reviews = await approvedReviews(6);
    return jsonOk({
      item: {
        ...item,
        variants: item.variants,
        addons: item.addons,
        categoryName: item.categoryName,
        categorySlug: item.categorySlug,
      },
      related: related.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        imageUrl: r.imageUrl,
        basePrice: r.basePrice,
        mrp: r.mrp,
        foodType: r.foodType,
        prepTimeMinutes: r.prepTimeMinutes,
        isAvailable: r.isAvailable,
        shortDescription: r.shortDescription,
        ratingAvg: r.ratingAvg,
        ratingCount: r.ratingCount,
      })),
      restaurant: { name: settings.name, brandMessage: settings.brandMessage, city: settings.city },
      reviews: reviews.slice(0, 3).map((r) => ({ id: r.id, customerName: r.customerName, rating: r.rating, comment: r.comment, createdAt: r.createdAt })),
    });
  }, "menu.detail");
}
