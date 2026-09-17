import type { MetadataRoute } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, menuItems } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const staticRoutes = [
    "",
    "/menu",
    "/offers",
    "/about",
    "/gallery",
    "/contact",
    "/faq",
    "/delivery-info",
    "/reservations",
    "/track",
    "/login",
    "/register",
    "/policies/privacy-policy",
    "/policies/terms-conditions",
    "/policies/refund-policy",
    "/policies/cancellation-policy",
    "/policies/delivery-policy",
    "/policies/reservation-policy",
  ].map((route) => ({ url: `${base}${route}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: route === "" ? 1 : 0.7 }));

  try {
    const [categoryRows, itemRows] = await Promise.all([
      db.select({ slug: categories.slug }).from(categories),
      db.select({ slug: menuItems.slug }).from(menuItems).where(sql`${menuItems.deletedAt} is null`),
    ]);
    return [
      ...staticRoutes,
      ...categoryRows.map((row) => ({ url: `${base}/menu/${row.slug}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.8 })),
      ...itemRows.map((row) => ({ url: `${base}/menu/${row.slug}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.6 })),
    ];
  } catch {
    return staticRoutes;
  }
}
