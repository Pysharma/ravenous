"use client";

import Link from "next/link";
import { useCart } from "@/components/site/CartProvider";

const QUICK = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/offers", label: "Offers" },
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
  { href: "/account/orders", label: "My Orders" },
  { href: "/reservations", label: "Reservations" },
];

const POLICIES = [
  { href: "/policies/privacy-policy", label: "Privacy" },
  { href: "/policies/terms-conditions", label: "Terms" },
  { href: "/policies/refund-policy", label: "Refund" },
  { href: "/policies/cancellation-policy", label: "Cancellation" },
  { href: "/policies/delivery-policy", label: "Delivery" },
  { href: "/policies/reservation-policy", label: "Reservation" },
];

export function Footer() {
  const { brand } = useCart();
  return (
    <footer className="mt-20 bg-ink text-cream">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="font-display text-2xl font-semibold tracking-wide">{brand.shortName.toUpperCase()}</p>
          <p className="text-xs uppercase tracking-[0.28em] text-gold">{brand.tagline}</p>
          <p className="mt-4 max-w-xs text-sm text-cream/70">{brand.social ? "" : ""}Good Food. Great Vibes. Made for Every Craving.</p>
          <p className="mt-4 text-sm text-cream/70">
            Public rating reference: {brand.publicRating}★ · {brand.publicReviewCount.toLocaleString("en-IN")} reviews (third-party reference data)
          </p>
        </div>
        <div>
          <p className="label !text-gold">Quick links</p>
          <ul className="grid gap-2 text-sm text-cream/80">
            {QUICK.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition hover:text-gold">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label !text-gold">Policies</p>
          <ul className="grid gap-2 text-sm text-cream/80">
            {POLICIES.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition hover:text-gold">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/faq" className="transition hover:text-gold">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/delivery-info" className="transition hover:text-gold">
                Delivery Info
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="label !text-gold">Contact</p>
          <p className="text-sm text-cream/80">{brand.address}</p>
          <p className="mt-2 text-sm">
            <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="transition hover:text-gold">
              {brand.phone}
            </a>
          </p>
          <p className="mt-1 text-sm text-cream/70">{brand.email}</p>
          <p className="mt-2 text-sm text-cream/70">{brand.services}</p>
          <p className="mt-2 text-sm text-cream/70">Price range: {brand.priceRange}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="btn btn-gold">
              Call Now
            </a>
            <a
              href={`https://wa.me/${(brand.whatsapp || brand.phone).replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline !border-cream/30 !text-cream"
            >
              WhatsApp
            </a>
            {brand.mapsUrl ? (
              <a href={brand.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-outline !border-cream/30 !text-cream">
                Directions
              </a>
            ) : null}
          </div>
        </div>
      </div>
      <div className="border-t border-cream/10 py-5">
        <div className="container-page flex flex-col gap-2 text-xs text-cream/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
          <p className="flex flex-wrap items-center gap-3">
            <span>Multi Cuisine · {brand.city}</span>
            <Link href="/admin/login" className="transition hover:text-gold">
              Staff / Admin Login
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
