import { SafeImage } from "@/components/site/SafeImage";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gallery" };

const TABS = [
  { key: "all", label: "All" },
  { key: "food", label: "Food" },
  { key: "interior", label: "Interior" },
  { key: "exterior", label: "Exterior" },
  { key: "events", label: "Events" },
  { key: "drinks", label: "Drinks" },
  { key: "kitchen", label: "Kitchen" },
];

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const settings = await getSettings();
  const images = await db.select().from(media).where(eq(media.isActive, true)).orderBy(asc(media.sortOrder));
  const filtered = category && category !== "all" ? images.filter((image) => image.category === category) : images;

  return (
    <div className="container-page py-12">
      <p className="label">Gallery</p>
      <h1 className="font-display text-4xl">{settings.galleryHeading}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/65">
        Food, drinks, interiors and the vibe at {settings.name}. Every image here is managed from the admin media library, so the team can
        replace any photo at any time.
      </p>
      <nav className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <a key={tab.key} href={`/gallery?category=${tab.key}`} className={`badge whitespace-nowrap px-3 py-1.5 text-xs ${((category ?? "all") === tab.key ? "badge-ember" : "badge-muted")}`}>
            {tab.label}
          </a>
        ))}
      </nav>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((image, index) => (
          <figure key={image.id} className={`group relative overflow-hidden rounded-2xl border border-ink/8 ${index % 5 === 0 ? "aspect-[3/4]" : "aspect-square"}`}>
            <SafeImage src={image.url} alt={image.altText || image.title || "Ravenous"} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition duration-700 group-hover:scale-105" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-3 text-xs text-cream opacity-0 transition group-hover:opacity-100">
              {image.title ?? image.category}
            </figcaption>
          </figure>
        ))}
      </div>
      {!filtered.length ? <p className="mt-6 text-sm text-ink/60">No images in this category yet.</p> : null}
    </div>
  );
}
