import Link from "next/link";
import { getSettings, telLink, whatsappLink } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "FAQ" };

const FAQS: { q: string; a: string }[] = [
  { q: "How do I order?", a: "Choose your dishes, add them to the cart, customise where needed, then check out. You can pay online, choose cash on delivery where enabled, or pay at the restaurant." },
  { q: "Can I customise my food?", a: "Yes. Where a dish supports customisation you can choose size, spice level, add-ons and preferences such as no onion, no garlic, Jain, less oil or less spicy. The price updates instantly and is recalculated on our server at checkout." },
  { q: "Do you offer delivery?", a: "Yes, inside the delivery area configured by the restaurant around Bilaspur. Delivery charges are distance-based and applied once per order, with free delivery above the configured order value." },
  { q: "What if you don't deliver to my location?", a: "We will tell you clearly at checkout. You can still book a table, order for pickup, or call the restaurant to arrange something." },
  { q: "Can I pick up my order?", a: "Yes, when pickup is enabled. You'll see the restaurant address and an estimated preparation time, and we notify you when your order is ready for pickup." },
  { q: "Can I reserve a table?", a: "Yes, where reservations are enabled. Choose a date, time and guest count; the restaurant confirms your booking and you are notified." },
  { q: "Can I order from my table?", a: "Yes. Scan the QR code on your table to open the dine-in menu, add items, send the order to the kitchen and request the bill when you're done." },
  { q: "Can I track my order?", a: "Yes. Open Track Order from your account to see live status: placed, accepted, preparing, ready, out for delivery and delivered (or served for dine-in)." },
  { q: "Can I cancel?", a: "Cancellation depends on order status and restaurant settings. You can cancel within the cancellation window or before preparation starts. Once preparation begins, cancellation may no longer be available." },
  { q: "How are refunds handled?", a: "Refunds are shown as pending until initiated and only marked completed after our payment partner confirms them. A refund is never shown as completed early." },
  { q: "How do I get an invoice?", a: "Open My Orders, choose an order and select Download Invoice. The printable invoice includes itemised lines, taxes and payment status." },
];

export default async function FaqPage() {
  const settings = await getSettings();
  return (
    <div className="container-page py-12">
      <p className="label">Help centre</p>
      <h1 className="font-display text-4xl">Frequently asked questions</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/65">
        Still need help? Call {settings.phone} or message us on WhatsApp — our team can look up any order by its order ID.
      </p>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {FAQS.map((faq) => (
          <details key={faq.q} className="card p-5">
            <summary className="cursor-pointer font-medium">{faq.q}</summary>
            <p className="mt-3 text-sm text-ink/70">{faq.a}</p>
          </details>
        ))}
      </div>
      <div className="card mt-8 flex flex-wrap gap-3 p-6">
        <a href={telLink(settings.phone)} className="btn btn-primary">
          Call Restaurant
        </a>
        <a href={whatsappLink(settings, "Hello Ravenous, I have a question.")} target="_blank" rel="noreferrer" className="btn btn-gold">
          Chat on WhatsApp
        </a>
        <Link href="/account/support" className="btn btn-outline">
          Submit a support ticket
        </Link>
      </div>
    </div>
  );
}
