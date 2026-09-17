import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SafeImage } from "@/components/site/SafeImage";
import { FoodCard } from "@/components/site/FoodCard";
import { ItemDetailPanel } from "@/components/site/ItemDetailPanel";
import { MenuBrowser } from "@/components/site/MenuBrowser";
import { Reveal } from "@/components/site/Reveal";
import { formatINR, discountPercent } from "@/lib/format";
import { approvedReviews, getCategoryBySlug, getMenuBySlug, getRelatedItems, listMenu } from "@/lib/menu";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (category) {
    return {
      title: category.seoTitle ?? `${category.name} menu`,
      description: category.seoDescription ?? category.description ?? `Order ${category.name} online from Ravenous.`,
      alternates: { canonical: `/menu/${category.slug}` },
    };
  }
  const item = await getMenuBySlug(slug);
  if (!item) return { title: "Not found" };
  return {
    title: item.seoTitle ?? item.name,
    description: item.seoDescription ?? item.shortDescription ?? item.description ?? undefined,
    alternates: { canonical: `/menu/${item.slug}` },
    openGraph: { title: item.name, images: item.imageUrl ? [item.imageUrl] : undefined },
  };
}

export default async function MenuItemOrCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (category) {
    const result = await listMenu({ category: slug, perPage: 60 });
    const settings = await getSettings();
    const structured = {
      "@context": "https://schema.org",
      "@type": "Menu",
      name: `${category.name} — ${settings.name}`,
      hasMenuSection: {
        "@type": "MenuSection",
        name: category.name,
        hasMenuItem: result.items.slice(0, 20).map((item) => ({
          "@type": "MenuItem",
          name: item.name,
          description: item.shortDescription ?? undefined,
          offers: { "@type": "Offer", price: (item.basePrice / 100).toFixed(2), priceCurrency: "INR" },
        })),
      },
    };
    return (
      <div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />
        <section className="relative overflow-hidden bg-ink py-14 text-cream">
          <div className="absolute inset-0 opacity-30">
            <SafeImage src={category.imageUrl} alt={category.name} fill sizes="100vw" className="object-cover" />
          </div>
          <div className="container-page relative">
            <nav className="text-xs text-cream/60">
              <Link href="/" className="hover:text-gold">Home</Link> / <Link href="/menu" className="hover:text-gold">Menu</Link> /{" "}
              <span className="text-gold">{category.name}</span>
            </nav>
            <h1 className="mt-3 font-display text-3xl sm:text-5xl">{category.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-cream/75">{category.description}</p>
            <p className="mt-3 text-xs uppercase tracking-widest text-cream/50">
              {result.total} dishes · approx {category.prepTimeMinutes} min preparation
            </p>
          </div>
        </section>
        <MenuBrowser initialCategory={category.slug} lockedCategory={category.slug} />
      </div>
    );
  }

  const item = await getMenuBySlug(slug);
  if (!item) notFound();

  const [related, settings, reviews] = await Promise.all([getRelatedItems(item, 3), getSettings(), approvedReviews(4)]);
  const defaultVariant = item.variants.find((v) => v.isDefault) ?? item.variants[0] ?? null;
  const price = defaultVariant?.price ?? item.basePrice;
  const mrp = defaultVariant ? Math.max(defaultVariant.mrp, defaultVariant.price) : Math.max(item.mrp, item.basePrice);
  const off = discountPercent(mrp, price);

  const structured = {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    name: item.name,
    description: item.shortDescription ?? item.description ?? undefined,
    image: item.imageUrl ?? undefined,
    suitableForDiet: item.foodType === "veg" ? "https://schema.org/VegetarianDiet" : undefined,
    offers: { "@type": "Offer", price: (price / 100).toFixed(2), priceCurrency: "INR", availability: item.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
    ...(item.ratingCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: (item.ratingAvg / 10).toFixed(1), reviewCount: item.ratingCount } }
      : {}),
    ...(reviews.length
      ? { review: reviews.slice(0, 2).map((r) => ({ "@type": "Review", reviewRating: { "@type": "Rating", ratingValue: r.rating }, author: { "@type": "Person", name: r.customerName }, reviewBody: r.comment })) }
      : {}),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />
      <div className="container-page py-8">
        <nav className="text-xs text-ink/55">
          <Link href="/menu" className="hover:text-ember">Menu</Link>
          {item.categorySlug ? (
            <>
              {" / "}
              <Link href={`/menu/${item.categorySlug}`} className="hover:text-ember">
                {item.categoryName}
              </Link>
            </>
          ) : null}
          {" / "}
          <span className="text-ink/80">{item.name}</span>
        </nav>

        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <Reveal>
            <div className="space-y-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-ink/8">
                <SafeImage src={item.imageUrl} alt={item.name} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" priority />
                {off > 0 ? <span className="badge badge-ember absolute left-4 top-4">{off}% off</span> : null}
                {item.isDemoData ? <span className="badge badge-muted absolute right-4 top-4">Demo menu item</span> : null}
              </div>
              {item.gallery.length > 1 ? (
                <div className="grid grid-cols-3 gap-2">
                  {item.gallery.slice(0, 3).map((image) => (
                    <div key={image} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-ink/8">
                      <SafeImage src={image} alt={`${item.name} photo`} fill sizes="33vw" className="object-cover" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Reveal>

          <div>
            <Reveal>
              <div className="flex flex-wrap items-center gap-2">
                <span className={item.foodType === "nonveg" ? "badge badge-nonveg" : item.foodType === "egg" ? "badge badge-egg" : "badge badge-veg"}>
                  {item.foodType === "nonveg" ? "🔴 Non-veg" : item.foodType === "egg" ? "🥚 Egg" : "🌱 Veg"}
                </span>
                {item.isBestseller ? <span className="badge badge-gold">⭐ Bestseller</span> : null}
                {item.isPopular ? <span className="badge badge-ember">🔥 Popular</span> : null}
                {item.isNew ? <span className="badge badge-gold">🆕 New</span> : null}
                {item.spiceLevel !== "mild" ? <span className="badge badge-muted">🌶 {item.spiceLevel.replace("_", " ")}</span> : null}
                {item.isJain ? <span className="badge badge-muted">Jain option</span> : null}
              </div>
              <h1 className="mt-3 font-display text-3xl sm:text-4xl">{item.name}</h1>
              <p className="mt-2 text-sm text-ink/65">
                {item.cuisine} {item.categoryName ? `· ${item.categoryName}` : ""} · {item.servingSize} · {item.prepTimeMinutes} min
                {item.calories ? ` · ${item.calories} kcal` : ""}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="font-display text-3xl">{formatINR(price)}</span>
                {off > 0 ? <span className="text-lg text-ink/45 line-through">{formatINR(mrp)}</span> : null}
                {item.ratingCount > 0 ? (
                  <span className="badge badge-gold">
                    ★ {(item.ratingAvg / 10).toFixed(1)} ({item.ratingCount})
                  </span>
                ) : null}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink/75">{item.description}</p>
            </Reveal>

            <Reveal delay={80}>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="card p-4">
                  <p className="label">Ingredients</p>
                  <p className="text-sm text-ink/70">{item.ingredients}</p>
                </div>
                <div className="card p-4">
                  <p className="label">Allergen information</p>
                  <p className="text-sm text-ink/70">
                    {item.allergens ? item.allergens : "No major allergens declared"}
                    <span className="mt-1 block text-xs text-ink/45">
                      Informational label only. Please inform our staff about allergies before ordering.
                    </span>
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="mt-5">
                <ItemDetailPanel item={item} />
              </div>
            </Reveal>
          </div>
        </div>

        {related.length ? (
          <section className="mt-14">
            <h2 className="font-display text-2xl">More from {item.categoryName ?? "the menu"}</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((relatedItem) => (
                <FoodCard key={relatedItem.id} item={relatedItem} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-12">
          <h2 className="font-display text-2xl">What guests say</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 3).map((review) => (
              <figure key={review.id} className="card p-5">
                <span className="badge badge-gold">{"★".repeat(review.rating)}</span>
                <blockquote className="mt-3 text-sm text-ink/75">“{review.comment}”</blockquote>
                <figcaption className="mt-3 text-xs text-ink/50">{review.customerName}</figcaption>
              </figure>
            ))}
            {!reviews.length ? <p className="text-sm text-ink/60">No reviews for this dish yet.</p> : null}
          </div>
          <p className="mt-4 text-xs text-ink/50">
            Public rating reference for {settings.name}: {settings.publicRating}★ ({settings.publicReviewCount.toLocaleString("en-IN")} reviews
            from third-party listings).
          </p>
        </section>
      </div>
    </div>
  );
}
