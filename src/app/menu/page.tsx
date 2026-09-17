import type { Metadata } from "next";
import { MenuBrowser } from "@/components/site/MenuBrowser";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: `Menu — ${settings.name}`,
    description: `Explore the full Ravenous multi-cuisine menu: biryani, Chinese, tandoor, pizzas, noodles, desserts and drinks. Order online in ${settings.city}.`,
    alternates: { canonical: "/menu" },
  };
}

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; sort?: string; foodType?: string }> }) {
  const params = await searchParams;
  return (
    <div>
      <section className="bg-ink py-12 text-cream">
        <div className="container-page">
          <p className="label !text-gold">Full menu</p>
          <h1 className="font-display text-3xl sm:text-5xl">Every craving, one menu</h1>
          <p className="mt-3 max-w-2xl text-sm text-cream/75">
            Filter by veg or non-veg, price, spice level and popularity. Items marked “Demo menu item” are sample data created for this
            demo dataset — the kitchen team can replace every dish, photo and price from the admin dashboard.
          </p>
        </div>
      </section>
      <MenuBrowser
        initialQuery={params.q ?? ""}
        initialCategory={params.category ?? ""}
        initialSort={params.sort ?? "recommended"}
        initialFoodType={params.foodType ?? "all"}
      />
    </div>
  );
}
