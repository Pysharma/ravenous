import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";

const TABS = [
  { href: "/account", label: "Profile" },
  { href: "/account/orders", label: "My Orders" },
  { href: "/account/favorites", label: "Favorites" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/reservations", label: "Reservations" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/support", label: "Support" },
];

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label">My account</p>
          <h1 className="font-display text-3xl">Hello, {user.name.split(" ")[0]}</h1>
        </div>
        <Link href="/menu" className="btn btn-primary">
          Order something
        </Link>
      </div>
      <nav className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} className="badge badge-muted whitespace-nowrap px-3 py-1.5 text-xs hover:bg-ink/12">
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
