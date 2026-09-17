import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CartProvider } from "@/components/site/CartProvider";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { getSettings, fullAddress, openState, todayHoursLabel } from "@/lib/settings";

/// Brand/settings (logo, hero image, hours, status banner) must always be read
/// fresh from the database so admin changes appear on every page immediately.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = `${settings.shortDescription} Order online for delivery, pickup and dine-in in ${settings.city}.`;
  return {
    title: {
      default: `${settings.name} | ${settings.tagline} in ${settings.city}`,
      template: `%s | ${settings.name}`,
    },
    description,
    applicationName: settings.name,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    openGraph: {
      title: `${settings.name} — ${settings.brandMessage}`,
      description,
      type: "website",
      images: settings.heroImageUrl ? [settings.heroImageUrl] : undefined,
    },
    twitter: { card: "summary_large_image" },
    icons: settings.faviconUrl ? { icon: settings.faviconUrl } : undefined,
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  const state = openState(settings);
  const brand = {
    name: settings.name,
    shortName: settings.shortName,
    tagline: settings.tagline,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    logoUrl: settings.logoUrl,
    city: settings.city,
    address: fullAddress(settings),
    open: state.open,
    statusMessage: state.bannerMessage ?? null,
    todayHours: todayHoursLabel(settings),
    publicRating: settings.publicRating,
    publicReviewCount: settings.publicReviewCount,
    email: settings.email,
    priceRange: settings.priceRange,
    services: settings.services,
    mapsUrl: settings.mapsUrl,
    latitude: settings.latitude,
    longitude: settings.longitude,
    social: settings.social ?? {},
    deliveryEnabled: (settings.ordering?.deliveryEnabled ?? true),
    reservationEnabled: (settings.reservation?.enabled ?? true),
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: settings.name,
    servesCuisine: ["Indian", "Chinese", "Continental", "Multi Cuisine"],
    priceRange: settings.priceRange,
    telephone: settings.phone,
    email: settings.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.addressLine,
      addressLocality: settings.city,
      addressRegion: settings.state,
      postalCode: settings.pincode,
      addressCountry: settings.country,
    },
    ...(settings.latitude && settings.longitude
      ? { geo: { "@type": "GeoCoordinates", latitude: settings.latitude, longitude: settings.longitude } }
      : {}),
    ...(settings.heroImageUrl ? { image: settings.heroImageUrl } : {}),
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  };

  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <CartProvider brand={brand}>
          <Header />
          <main className="min-h-[60vh]">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
