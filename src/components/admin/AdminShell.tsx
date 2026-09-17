"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminLogin, useAdminSession } from "@/components/admin/AdminPanels";
import { formatDateTime } from "@/lib/format";

const NAV: { group: string; links: { href: string; label: string; permission?: string }[] }[] = [
  {
    group: "Operations",
    links: [
      { href: "/admin/dashboard", label: "Dashboard", permission: "orders.view" },
      { href: "/admin/orders", label: "Orders", permission: "orders.view" },
      { href: "/admin/kitchen", label: "Kitchen (KDS)", permission: "kitchen.view" },
      { href: "/admin/tables", label: "Tables & QR", permission: "tables.manage" },
      { href: "/admin/delivery-zones", label: "Delivery zones", permission: "delivery.view" },
      { href: "/admin/inventory", label: "Inventory", permission: "inventory.manage" },
    ],
  },
  {
    group: "Menu",
    links: [
      { href: "/admin/menu", label: "Menu & dishes", permission: "menu.view" },
      { href: "/admin/categories", label: "Categories", permission: "menu.view" },
      { href: "/admin/addons", label: "Add-ons", permission: "menu.view" },
      { href: "/admin/variants", label: "Variants", permission: "menu.view" },
    ],
  },
  {
    group: "Guests & payments",
    links: [
      { href: "/admin/customers", label: "Customers", permission: "customers.view" },
      { href: "/admin/reservations", label: "Reservations", permission: "reservations.manage" },
      { href: "/admin/support-tickets", label: "Support tickets", permission: "support.manage" },
      { href: "/admin/refunds", label: "Refunds", permission: "orders.refund" },
    ],
  },
  {
    group: "Marketing & content",
    links: [
      { href: "/admin/coupons", label: "Offers & coupons", permission: "offers.manage" },
      { href: "/admin/reviews", label: "Reviews", permission: "reviews.manage" },
      { href: "/admin/media", label: "Media library", permission: "content.manage" },
      { href: "/admin/gallery", label: "Gallery images", permission: "content.manage" },
      { href: "/admin/homepage", label: "Homepage CMS", permission: "content.manage" },
      { href: "/admin/legal-pages", label: "Legal pages", permission: "content.manage" },
    ],
  },
  {
    group: "Administration",
    links: [
      { href: "/admin/settings", label: "Restaurant settings", permission: "settings.manage" },
      { href: "/admin/reports", label: "Reports & analytics", permission: "reports.view" },
      { href: "/admin/notifications", label: "Notifications", permission: "orders.view" },
      { href: "/admin/admins", label: "Admin users", permission: "admins.manage" },
      { href: "/admin/roles", label: "Roles & permissions", permission: "admins.manage" },
      { href: "/admin/profile", label: "My profile" },
    ],
  },
];

type AdminNotification = { id: number; title: string; body: string | null; link: string | null; isRead: boolean; createdAt: string };

export function AdminShell({ children }: { children: ReactNode }) {
  const { admin, loading, logout, refresh } = useAdminSession();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [showBell, setShowBell] = useState(false);
  const [showNav, setShowNav] = useState(false);

  useEffect(() => {
    if (!admin) return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/notifications?audience=admin", { cache: "no-store" });
        const data = (await response.json()) as { notifications: AdminNotification[] };
        setNotifications(data.notifications ?? []);
      } catch {
        // ignore
      }
    }, 15000);
    void (async () => {
      try {
        const response = await fetch("/api/notifications?audience=admin", { cache: "no-store" });
        const data = (await response.json()) as { notifications: AdminNotification[] };
        setNotifications(data.notifications ?? []);
      } catch {
        // ignore
      }
    })();
    return () => clearInterval(interval);
  }, [admin]);

  if (loading) {
    return (
      <div className="container-page py-20">
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="container-page py-16">
        <AdminLogin />
      </div>
    );
  }

  const unread = notifications.filter((notification) => !notification.isRead).length;

  return (
    <div className="container-page py-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="label">Ravenous admin</p>
          <h1 className="font-display text-2xl">Dashboard</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="badge badge-muted">
            {admin.name} · {admin.roleName}
          </span>
          <div className="relative">
            <button type="button" className="btn btn-outline px-3 py-1.5 text-xs" onClick={() => setShowBell((value) => !value)}>
              🔔 {unread ? <span className="ml-1 rounded-full bg-ember px-1.5 text-[10px] text-white">{unread}</span> : null}
            </button>
            {showBell ? (
              <div className="card absolute right-0 z-20 mt-2 w-80 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Notifications</p>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={async () => {
                      await fetch("/api/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ all: true, audience: "admin" }),
                      });
                      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
                    }}
                  >
                    Mark all read
                  </button>
                </div>
                <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                  {notifications.slice(0, 12).map((notification) => (
                    <li key={notification.id} className="rounded-xl bg-cream-dark/70 p-2">
                      <p className="font-medium">{notification.title}</p>
                      {notification.body ? <p className="text-xs text-ink/60">{notification.body}</p> : null}
                      <p className="mt-1 text-[10px] text-ink/45">{formatDateTime(notification.createdAt)}</p>
                      {notification.link ? (
                        <Link href={notification.link} className="text-xs underline" onClick={() => setShowBell(false)}>
                          Open
                        </Link>
                      ) : null}
                    </li>
                  ))}
                  {!notifications.length ? <li className="text-xs text-ink/55">No notifications yet.</li> : null}
                </ul>
              </div>
            ) : null}
          </div>
          <Link href="/" className="btn btn-outline px-3 py-1.5 text-xs">
            View site
          </Link>
          <button type="button" className="btn btn-dark px-3 py-1.5 text-xs" onClick={() => void logout()}>
            Logout
          </button>
          <button type="button" className="btn btn-outline px-3 py-1.5 text-xs xl:hidden" onClick={() => setShowNav((value) => !value)}>
            Menu
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[240px_1fr]">
        <aside className={`${showNav ? "block" : "hidden"} xl:block`}>
          <nav className="card sticky top-24 max-h-[80vh] overflow-y-auto p-3 text-sm">
            {NAV.map((group) => {
              const links = group.links.filter((link) => !link.permission || admin.isSuperAdmin || admin.permissions.includes(link.permission));
              if (!links.length) return null;
              return (
                <div key={group.group} className="mb-4">
                  <p className="label px-2">{group.group}</p>
                  <ul className="space-y-1">
                    {links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className={`block rounded-xl px-3 py-2 transition ${pathname === link.href ? "bg-ink text-cream" : "hover:bg-cream-dark"}`}
                          onClick={() => setShowNav(false)}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </aside>
        <section>{children}</section>
      </div>
      <p className="mt-6 text-xs text-ink/45">
        Signed in as {admin.email} · Permissions are enforced on the server for every action.{" "}
        <button type="button" className="underline" onClick={() => void refresh()}>
          Refresh session
        </button>
      </p>
    </div>
  );
}
