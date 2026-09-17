import { MenuBrowser } from "@/components/site/MenuBrowser";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search the menu" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const settings = await getSettings();
  return (
    <div>
      <section className="bg-ink py-10 text-cream">
        <div className="container-page">
          <p className="label !text-gold">Search</p>
          <h1 className="font-display text-3xl sm:text-4xl">{q ? `Results for “${q}”` : "Search the Ravenous menu"}</h1>
          <form action="/search" method="get" className="mt-5 flex max-w-xl gap-2">
            <input name="q" defaultValue={q ?? ""} className="input py-3" placeholder="Biryani, fried rice, paneer, noodles, desserts..." aria-label="Search dishes" />
            <button type="submit" className="btn btn-primary px-5">
              Search
            </button>
          </form>
          <p className="mt-3 text-xs text-cream/60">
            Search by dish name, category, cuisine, ingredient or tag. Results are ranked from the {settings.name} menu.
          </p>
        </div>
      </section>
      <MenuBrowser initialQuery={q ?? ""} />
    </div>
  );
}
