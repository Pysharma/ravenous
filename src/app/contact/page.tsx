import { getSettings, fullAddress, hoursOf, telLink, whatsappLink, directionsUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contact Ravenous" };

export default async function ContactPage() {
  const settings = await getSettings();
  const hours = hoursOf(settings);
  return (
    <div className="container-page py-12">
      <p className="label">Contact</p>
      <h1 className="font-display text-4xl">Contact Ravenous</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-display text-xl">{settings.name}</h2>
            <p className="mt-2 text-sm text-ink/70">{fullAddress(settings)}</p>
            <p className="mt-2 text-sm">
              Phone:{" "}
              <a href={telLink(settings.phone)} className="font-semibold underline">
                {settings.phone}
              </a>
              {settings.altPhone ? ` · ${settings.altPhone}` : ""}
            </p>
            <p className="mt-1 text-sm">WhatsApp: {settings.whatsapp}</p>
            <p className="mt-1 text-sm">Email: {settings.email}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={telLink(settings.phone)} className="btn btn-primary">
                Call Now
              </a>
              <a href={whatsappLink(settings, `Hello ${settings.shortName}, I would like to place an order.`)} target="_blank" rel="noreferrer" className="btn btn-gold">
                WhatsApp
              </a>
              <a href={directionsUrl(settings)} target="_blank" rel="noreferrer" className="btn btn-outline">
                Get Directions
              </a>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-display text-xl">Opening hours</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {hours.map((day) => (
                <li key={day.day} className="flex justify-between border-b border-ink/8 pb-1">
                  <span className="text-ink/65">{day.day}</span>
                  <span className={day.closed ? "text-[#a12622]" : "font-medium"}>
                    {day.closed ? "Closed" : `${day.open} – ${day.close}`}
                    {day.special ? ` · ${day.special}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5 text-sm text-ink/70">
            <h2 className="font-display text-xl">Payment & support</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Online payment (UPI, cards, net banking, wallets) via Razorpay.</li>
              <li>Cash on delivery and pay at restaurant where enabled.</li>
              <li>Order support: call or WhatsApp us with your order ID.</li>
            </ul>
          </div>
        </div>

        <div className="card overflow-hidden">
          {settings.latitude && settings.longitude ? (
            <iframe
              title="Ravenous location"
              className="h-[420px] w-full"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(settings.longitude) - 0.01}%2C${Number(settings.latitude) - 0.008}%2C${
                Number(settings.longitude) + 0.01
              }%2C${Number(settings.latitude) + 0.008}&layer=mapnik&marker=${settings.latitude}%2C${settings.longitude}`}
            />
          ) : (
            <div className="p-6 text-sm text-ink/60">
              Map coordinates are not configured. Add latitude and longitude in Restaurant Settings to show the map.
            </div>
          )}
          <div className="p-5 text-sm">
            <p className="label">Find us</p>
            <p>{settings.services} · {settings.priceRange}</p>
            <p className="mt-2 text-ink/65">
              Public rating reference: {settings.publicRating}★ ({settings.publicReviewCount.toLocaleString("en-IN")} reviews)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
