"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/site/CartProvider";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/offers", label: "Offers" },
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const { brand, cartCount, user, refreshUser, toast } = useCart();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    void (async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        const data = (await response.json()) as { unread: number };
        setUnread(data.unread ?? 0);
      } catch {
        setUnread(0);
      }
    })();
  }, [user, cartCount]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    router.push(`/menu?q=${encodeURIComponent(query)}`);
    setShowSearch(false);
  };

  const logout = async () => {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    await refreshUser();
    toast("Signed out", "info");
    setShowAccount(false);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-[60]">
      {!brand.open || brand.statusMessage ? (
        <div className="bg-ink px-4 py-1.5 text-center text-xs font-medium text-gold">{brand.statusMessage ?? `Currently closed · Today ${brand.todayHours}`}</div>
      ) : null}
      <div className="glass">
        <div className="container-page flex h-16 items-center gap-3">
          <Link href="/" className="flex items-center gap-2" aria-label={`${brand.name} home`}>
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={`${brand.name} logo`} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-lg text-gold">R</span>
            )}
            <span className="leading-none">
              <span className="block font-display text-lg font-semibold tracking-wide">{brand.shortName}</span>
              <span className="block text-[10px] uppercase tracking-[0.22em] text-ink/55">{brand.tagline}</span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-5 text-sm font-medium lg:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-ember">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <form onSubmit={submitSearch} className={`hidden items-center md:flex ${showSearch ? "" : "md:hidden"}`}>
              <input
                className="input w-56 py-1.5"
                placeholder="Search dishes, cuisines..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search the menu"
              />
            </form>
            <button type="button" onClick={() => setShowSearch((v) => !v)} className="btn btn-outline hidden h-9 w-9 p-0 md:inline-flex" aria-label="Toggle search">
              🔍
            </button>
            <Link href="/search" className="btn btn-outline h-9 w-9 p-0 md:hidden" aria-label="Search menu">
              🔍
            </Link>
            {brand.reservationEnabled ? (
              <Link href="/reservations" className="btn btn-outline hidden lg:inline-flex">
                Reservation
              </Link>
            ) : null}
            <Link href="/cart" className="btn btn-dark relative" aria-label={`Cart with ${cartCount} items`}>
              🛒
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ember px-1 text-[11px] font-bold text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>
            {user ? (
              <div className="relative">
                <button type="button" className="btn btn-outline" onClick={() => setShowAccount((v) => !v)} aria-expanded={showAccount}>
                  Hi, {user.name.split(" ")[0]}
                  {unread ? <span className="ml-1 rounded-full bg-ember px-1.5 text-[10px] font-bold text-white">{unread}</span> : null}
                </button>
                {showAccount ? (
                  <div className="card absolute right-0 mt-2 w-56 p-2 text-sm">
                    {[
                      { href: "/account", label: "My Profile" },
                      { href: "/account/orders", label: "My Orders" },
                      { href: "/account/favorites", label: "Favorites" },
                      { href: "/account/addresses", label: "Saved Addresses" },
                      { href: "/account/reservations", label: "Reservations" },
                      { href: "/account/notifications", label: "Notifications" },
                      { href: "/account/support", label: "Help & Support" },
                    ].map((item) => (
                      <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 hover:bg-cream-dark" onClick={() => setShowAccount(false)}>
                        {item.label}
                      </Link>
                    ))}
                    <button type="button" onClick={logout} className="mt-1 w-full rounded-lg bg-ink px-3 py-2 text-left text-cream">
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link href="/login" className="btn btn-outline hidden sm:inline-flex">
                Login
              </Link>
            )}
            <button type="button" className="btn btn-outline h-9 w-9 p-0 lg:hidden" onClick={() => setShowMobileNav((v) => !v)} aria-label="Open menu">
              ☰
            </button>
          </div>
        </div>
        {showMobileNav ? (
          <nav className="container-page grid gap-1 pb-3 lg:hidden">
            {[...NAV, { href: "/reservations", label: "Book a Table" }, { href: user ? "/account" : "/login", label: user ? "My Account" : "Login / Register" }].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm font-medium hover:bg-white/70"
                onClick={() => setShowMobileNav(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
