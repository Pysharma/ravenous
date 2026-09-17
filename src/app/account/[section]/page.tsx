import { notFound } from "next/navigation";
import { AccountSections } from "@/components/site/AccountSections";

export const dynamic = "force-dynamic";

const SECTIONS = ["addresses", "favorites", "reservations", "notifications", "support"];

export default async function AccountSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS.includes(section)) notFound();
  const titles: Record<string, { heading: string; sub: string }> = {
    addresses: { heading: "Saved addresses", sub: "Manage the addresses we deliver to." },
    favorites: { heading: "My favourites", sub: "Your saved dishes, ready to add to the cart." },
    reservations: { heading: "My reservations", sub: "Table bookings and their status." },
    notifications: { heading: "Notifications", sub: "Order, payment and reservation updates." },
    support: { heading: "Help & support", sub: "Raise and track support tickets for your orders." },
  };
  return (
    <div>
      <h2 className="font-display text-2xl">{titles[section].heading}</h2>
      <p className="mt-1 text-sm text-ink/60">{titles[section].sub}</p>
      <div className="mt-5">
        <AccountSections section={section} />
      </div>
    </div>
  );
}
