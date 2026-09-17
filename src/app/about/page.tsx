import Link from "next/link";
import { SafeImage } from "@/components/site/SafeImage";
import { getSettings, fullAddress } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "About Ravenous" };

export default async function AboutPage() {
  const settings = await getSettings();
  return (
    <div className="container-page py-12">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <p className="label">About us</p>
          <h1 className="font-display text-4xl sm:text-5xl">{settings.name}</h1>
          <p className="mt-2 text-sm uppercase tracking-[0.24em] text-gold">{settings.tagline}</p>
          <p className="mt-5 text-sm leading-relaxed text-ink/75">{settings.aboutText}</p>
          <p className="mt-4 text-sm leading-relaxed text-ink/75">
            Every plate is prepared fresh to order — from dum biryanis and Indo-Chinese favourites to tandoor specials, pizzas, refreshing
            mocktails and desserts. Dine with us in Bilaspur, pick up, or order delivery inside our service area.
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="card p-4">
              <dt className="label">Address</dt>
              <dd className="text-sm">{fullAddress(settings)}</dd>
            </div>
            <div className="card p-4">
              <dt className="label">Phone</dt>
              <dd className="text-sm">{settings.phone}</dd>
            </div>
            <div className="card p-4">
              <dt className="label">Services</dt>
              <dd className="text-sm">{settings.services}</dd>
            </div>
            <div className="card p-4">
              <dt className="label">Price range</dt>
              <dd className="text-sm">{settings.priceRange}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs text-ink/50">
            Public rating reference: {settings.publicRating}★ · {settings.publicReviewCount.toLocaleString("en-IN")} reviews (third-party
            listing data shown for reference).
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/menu" className="btn btn-primary">
              Order Now
            </Link>
            <Link href="/gallery" className="btn btn-outline">
              See the gallery
            </Link>
            <Link href="/contact" className="btn btn-outline">
              Contact us
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-ink/8 sm:col-span-2">
            <SafeImage src={settings.aboutImageUrl} alt={`${settings.name} dining area`} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" fallback="/images/interior.jpg" />
          </div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-ink/8">
            <SafeImage src="/images/exterior.jpg" alt={`${settings.name} exterior`} fill sizes="25vw" className="object-cover" />
          </div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-ink/8">
            <SafeImage src="/images/hero-dish.jpg" alt="Signature platter" fill sizes="25vw" className="object-cover" />
          </div>
        </div>
      </div>
    </div>
  );
}
