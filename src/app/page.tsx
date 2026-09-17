import Link from "next/link";
import { SafeImage } from "@/components/site/SafeImage";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { coupons, homepageSections, media } from "@/db/schema";
import { FoodCard } from "@/components/site/FoodCard";
import { Hero3D } from "@/components/site/Hero3D";
import { Reveal } from "@/components/site/Reveal";
import { formatINR } from "@/lib/format";
import { approvedReviews, listCategoriesWithCounts, listMenu } from "@/lib/menu";
import { getSettings, fullAddress, hoursOf, openState, todayHoursLabel } from "@/lib/settings";

export const dynamic = "force-dynamic";

type SectionRow = { title: string; subtitle: string | null; body: string | null; imageUrl: string | null; ctaLabel: string | null; ctaHref: string | null; secondaryCtaLabel: string | null; secondaryCtaHref: string | null };

export default async function HomePage() {
  const settings = await getSettings();
  const [sections, popular, featured, categoryRows, gallery, reviews, activeCoupons] = await Promise.all([
    db.select().from(homepageSections).where(eq(homepageSections.isActive, true)).orderBy(asc(homepageSections.position)),
    listMenu({ popular: true, perPage: 6, sort: "popular" }),
    listMenu({ featured: true, perPage: 3, sort: "recommended" }),
    listCategoriesWithCounts(),
    db.select().from(media).where(eq(media.isActive, true)).orderBy(asc(media.sortOrder)).limit(10),
    approvedReviews(6),
    db.select().from(coupons).where(eq(coupons.isActive, true)).orderBy(desc(coupons.id)).limit(4),
  ]);

  const sectionOf = (key: string): SectionRow | undefined => sections.find((s) => s.key === key) as SectionRow | undefined;
  const hero = sectionOf("hero");
  const state = openState(settings);
  const hours = hoursOf(settings);
  const heroImage = hero?.imageUrl || settings.heroImageUrl || "/images/hero-dish.jpg";
  const popularItems = popular.items.length ? popular.items : (await listMenu({ perPage: 6 })).items;

  return (
    <div>
      {/* ---------------------------------------------------------------- hero */}
      <section className="hero-glow relative overflow-hidden text-cream">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <Reveal>
              <span className="badge badge-gold">{settings.shortName.toUpperCase()} · {settings.tagline}</span>
              <h1 className="mt-4 font-display text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
                {hero?.title ?? settings.brandMessage}
              </h1>
              <p className="mt-4 max-w-xl text-base text-cream/75">
                {hero?.body ?? settings.brandSubtext}
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={hero?.ctaHref ?? "/menu"} className="btn btn-primary px-6 py-3 text-base">
                  {hero?.ctaLabel ?? "Order Now"}
                </Link>
                <Link href={hero?.secondaryCtaHref ?? "/menu"} className="btn btn-gold px-6 py-3 text-base">
                  {hero?.secondaryCtaLabel ?? "Explore Menu"}
                </Link>
                {settings.reservation?.enabled !== false ? (
                  <Link
                    href="/reservations"
                    className="btn btn-outline !border-cream/35 !text-cream px-6 py-3 text-base"
                  >
                    Book a Table
                  </Link>
                ) : null}
              </div>
            </Reveal>
            <Reveal delay={200}>
              <form action="/menu" method="get" className="mt-8 max-w-xl">
                <label htmlFor="hero-search" className="label !text-gold">
                  What are you craving today?
                </label>
                <div className="flex gap-2">
                  <input
                    id="hero-search"
                    name="q"
                    className="input !border-cream/20 !bg-white/95 py-3"
                    placeholder="Search dishes, cuisines, ingredients..."
                    list="hero-suggestions"
                  />
                  <button type="submit" className="btn btn-primary px-5">
                    Search
                  </button>
                </div>
                <datalist id="hero-suggestions">
                  {["Biryani", "Fried Rice", "Paneer", "Chicken", "Noodles", "Pizza", "Desserts", "Drinks"].map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              </form>
            </Reveal>
            <Reveal delay={260}>
              <dl className="mt-8 grid max-w-xl grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-cream/55">Open today</dt>
                  <dd className="font-semibold text-gold">{todayHoursLabel(settings)}</dd>
                </div>
                <div>
                  <dt className="text-cream/55">Public rating</dt>
                  <dd className="font-semibold text-gold">{settings.publicRating}★ reference</dd>
                </div>
                <div>
                  <dt className="text-cream/55">Price range</dt>
                  <dd className="font-semibold">{settings.priceRange}</dd>
                </div>
              </dl>
            </Reveal>
          </div>
          <Reveal delay={100} className="relative">
            <Hero3D imageUrl={heroImage} alt={`${settings.name} signature dish`} />
            <div className="mt-4 text-center text-xs text-cream/60">
              {state.open ? `${settings.services} · ${settings.city}` : state.bannerMessage}
            </div>
          </Reveal>
        </div>
        <div className="overflow-hidden border-t border-cream/10 py-3 text-xs uppercase tracking-[0.3em] text-cream/45">
          <div className="marquee-track">
            {[0, 1].map((pass) => (
              <span key={pass} className="flex gap-10">
                <span>Biryani</span><span>Chinese</span><span>Tandoor</span><span>Pizza</span><span>Noodles</span><span>Mocktails</span><span>Desserts</span><span>Combos</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- categories */}
      <section className="container-page py-14">
        <Reveal>
          <p className="label">Quick order categories</p>
          <h2 className="font-display text-3xl sm:text-4xl">{sectionOf("categories")?.title ?? "What are you craving today?"}</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink/60">{sectionOf("categories")?.body}</p>
        </Reveal>
        <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categoryRows
            .filter((category) => category.isActive)
            .slice(0, 12)
            .map((category, index) => (
              <Reveal key={category.id} delay={index * 40}>
                <Link
                  href={`/menu/${category.slug}`}
                  className="group relative block overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-[0_18px_40px_-34px_rgba(25,16,9,0.7)] transition hover:-translate-y-1"
                  style={{ transform: "perspective(700px)" }}
                >
                  <div className="relative aspect-[5/3]">
                    <SafeImage
                      src={category.imageUrl}
                      alt={category.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3 text-cream">
                    <p className="font-display text-lg leading-tight">{category.name}</p>
                    <p className="text-[11px] text-cream/70">
                      {category.itemCount} dishes · {category.prepTimeMinutes} min
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- popular */}
      <section className="bg-cream-dark/60 py-14">
        <div className="container-page">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="label">Bestsellers & popular picks</p>
                <h2 className="font-display text-3xl sm:text-4xl">{sectionOf("popular")?.title ?? "Ravenous favourites"}</h2>
                <p className="mt-2 max-w-2xl text-sm text-ink/60">{sectionOf("popular")?.body}</p>
              </div>
              <Link href="/menu" className="btn btn-dark">
                View full menu
              </Link>
            </div>
          </Reveal>
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {popularItems.map((item) => (
              <Reveal key={item.id}>
                <FoodCard item={item} />
              </Reveal>
            ))}
          </div>
          {featured.items.length ? (
            <div className="mt-10">
              <h3 className="font-display text-2xl">Featured this week</h3>
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featured.items.map((item) => (
                  <Reveal key={item.id}>
                    <FoodCard item={item} />
                  </Reveal>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* -------------------------------------------------------------- offers */}
      <section className="container-page py-14">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">Offers & happy hours</p>
              <h2 className="font-display text-3xl sm:text-4xl">{sectionOf("offers")?.title ?? "Save on your next craving"}</h2>
              <p className="mt-2 max-w-2xl text-sm text-ink/60">{sectionOf("offers")?.body}</p>
            </div>
            <Link href="/offers" className="btn btn-outline">
              See all offers
            </Link>
          </div>
        </Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {activeCoupons.map((coupon, index) => (
            <Reveal key={coupon.id} delay={index * 50}>
              <div className="card-dark flex h-full flex-col p-5">
                <p className="font-display text-xl text-gold">{coupon.code}</p>
                <p className="mt-1 text-sm text-cream/80">{coupon.name}</p>
                <p className="mt-3 text-xs text-cream/60">
                  {coupon.discountType === "percent"
                    ? `${coupon.discountValue}% off`
                    : coupon.discountType === "fixed"
                      ? `${formatINR(coupon.discountValue)} off`
                      : "Free delivery"}
                  {coupon.minOrder ? ` · min order ${formatINR(coupon.minOrder)}` : ""}
                  {coupon.startTime && coupon.endTime ? ` · ${coupon.startTime}–${coupon.endTime}` : ""}
                </p>
                <p className="mt-auto pt-4 text-[11px] uppercase tracking-widest text-cream/45">Apply at checkout</p>
              </div>
            </Reveal>
          ))}
          {!activeCoupons.length ? <p className="text-sm text-ink/60">No active offers right now. Please check back soon.</p> : null}
        </div>
      </section>

      {/* --------------------------------------------------------------- story */}
      <section className="bg-ink py-16 text-cream">
        <div className="container-page grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-gold/20">
              <SafeImage src={settings.aboutImageUrl} alt={`${settings.name} interior`} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" fallback="/images/interior.jpg" />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="label !text-gold">The Ravenous story</p>
            <h2 className="font-display text-3xl sm:text-4xl">{sectionOf("story")?.title ?? "A welcoming multi-cuisine destination"}</h2>
            <p className="mt-4 text-sm leading-relaxed text-cream/75">{sectionOf("story")?.body ?? settings.aboutText}</p>
            <p className="mt-4 text-sm leading-relaxed text-cream/75">{settings.aboutText}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/about" className="btn btn-gold">
                More about us
              </Link>
              <Link href="/menu" className="btn btn-outline !border-cream/30 !text-cream">
                Browse the menu
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------- gallery */}
      <section className="container-page py-14">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">Gallery</p>
              <h2 className="font-display text-3xl sm:text-4xl">{sectionOf("gallery")?.title ?? settings.galleryHeading}</h2>
              <p className="mt-2 max-w-2xl text-sm text-ink/60">{sectionOf("gallery")?.body}</p>
            </div>
            <Link href="/gallery" className="btn btn-outline">
              Open gallery
            </Link>
          </div>
        </Reveal>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {gallery.slice(0, 10).map((image, index) => (
            <Reveal key={image.id} delay={index * 30}>
              <div className={`relative overflow-hidden rounded-2xl border border-ink/8 ${index % 3 === 0 ? "aspect-[3/4]" : "aspect-square"}`}>
                <SafeImage src={image.url} alt={image.altText || image.title || "Ravenous"} fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover transition duration-700 hover:scale-105" />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- reviews */}
      <section className="bg-cream-dark/60 py-14">
        <div className="container-page">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="label">Guest reviews</p>
                <h2 className="font-display text-3xl sm:text-4xl">{sectionOf("reviews")?.title ?? "Loved by Bilaspur"}</h2>
                <p className="mt-2 max-w-2xl text-sm text-ink/60">
                  Public rating reference: {settings.publicRating}★ · {settings.publicReviewCount.toLocaleString("en-IN")} reviews from third-party
                  listings. Reviews below marked “demo” are sample content for the demo dataset.
                </p>
              </div>
              <Link href="/menu" className="btn btn-dark">
                Order your favourite
              </Link>
            </div>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 6).map((review) => (
              <Reveal key={review.id}>
                <figure className="card h-full p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="badge badge-gold">{"★".repeat(review.rating)}</span>
                    {review.isDemoData ? <span className="badge badge-muted">Demo review</span> : null}
                  </div>
                  <blockquote className="mt-3 text-sm text-ink/75">“{review.comment}”</blockquote>
                  <figcaption className="mt-3 text-xs text-ink/50">
                    {review.customerName}
                    {review.isVerified ? " · verified order" : ""}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ location */}
      <section className="container-page py-14">
        <div className="grid gap-8 lg:grid-cols-2">
          <Reveal>
            <p className="label">Visit us</p>
            <h2 className="font-display text-3xl sm:text-4xl">{sectionOf("location")?.title ?? "Find us in Bilaspur"}</h2>
            <p className="mt-3 text-sm text-ink/70">{fullAddress(settings)}</p>
            <p className="mt-1 text-sm text-ink/70">Phone: {settings.phone}</p>
            <p className="mt-1 text-sm text-ink/70">{settings.services} · {settings.priceRange}</p>
            <div className="mt-4 grid gap-2 text-sm">
              {hours.map((day) => (
                <div key={day.day} className="flex justify-between border-b border-ink/8 pb-1">
                  <span className="text-ink/60">{day.day}</span>
                  <span className={day.closed ? "text-[#a12622]" : "font-medium"}>
                    {day.closed ? "Closed" : `${day.open} – ${day.close}`}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="btn btn-primary">
                Call Now
              </a>
              <a
                href={`https://wa.me/${(settings.whatsapp || settings.phone).replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
              >
                WhatsApp
              </a>
              {settings.mapsUrl ? (
                <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                  Get Directions
                </a>
              ) : null}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="card overflow-hidden">
              {settings.latitude && settings.longitude ? (
                <iframe
                  title={`${settings.name} location map`}
                  className="h-[320px] w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(settings.longitude) - 0.01}%2C${
                    Number(settings.latitude) - 0.008
                  }%2C${Number(settings.longitude) + 0.01}%2C${Number(settings.latitude) + 0.008}&layer=mapnik&marker=${settings.latitude}%2C${
                    settings.longitude
                  }`}
                />
              ) : (
                <div className="p-6 text-sm text-ink/60">
                  Map coordinates are not configured yet. Please add latitude and longitude in Restaurant Settings.
                </div>
              )}
              <div className="p-5">
                <p className="font-display text-xl">{settings.name}</p>
                <p className="mt-1 text-sm text-ink/65">{fullAddress(settings)}</p>
                <div className="mt-3 flex gap-2">
                  <Link href="/reservations" className="btn btn-outline">
                    Book a Table
                  </Link>
                  <Link href="/contact" className="btn btn-outline">
                    Contact
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      {/* ----------------------------------------------------------- final CTA */}
      <section className="hero-glow py-16 text-cream">
        <div className="container-page flex flex-col items-center gap-5 text-center">
          <Reveal>
            <p className="badge badge-gold">{settings.tagline}</p>
            <h2 className="mt-4 font-display text-3xl sm:text-5xl">{sectionOf("final-cta")?.title ?? "Hungry already?"}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-cream/75">{sectionOf("final-cta")?.body}</p>
          </Reveal>
          <Reveal delay={100}>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/menu" className="btn btn-primary px-6 py-3 text-base">
                {sectionOf("final-cta")?.ctaLabel ?? "Order Now"}
              </Link>
              <Link href="/reservations" className="btn btn-gold px-6 py-3 text-base">
                {sectionOf("final-cta")?.secondaryCtaLabel ?? "Book a Table"}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
