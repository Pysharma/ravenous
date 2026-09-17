import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { formatDateTime, formatINR } from "@/lib/format";
import { statusLabel } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, telLink, whatsappLink } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Track your order" };

export default async function TrackLookupPage() {
  const user = await getCurrentUser();
  const settings = await getSettings();
  const recent = user
    ? await db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(5)
    : [];

  return (
    <div className="container-page py-14">
      <p className="label">Order tracking</p>
      <h1 className="font-display text-3xl sm:text-4xl">Track your order</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/65">
        Sign in to see live status updates for every order you place with Ravenous, or use the tracking link in your order confirmation.
      </p>

      {user ? (
        recent.length ? (
          <ul className="mt-6 space-y-3">
            {recent.map((order) => (
              <li key={order.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{order.orderCode}</p>
                  <p className="text-xs text-ink/55">
                    {formatDateTime(order.createdAt)} · {order.orderType} · {formatINR(order.total)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge badge-muted">{statusLabel(order.status)}</span>
                  <Link href={`/track/${order.id}`} className="btn btn-primary px-4 py-1.5 text-xs">
                    Track
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card mt-6 p-8 text-center">
            <p className="font-display text-xl">No orders yet.</p>
            <Link href="/menu" className="btn btn-primary mt-4">
              Order Something Delicious
            </Link>
          </div>
        )
      ) : (
        <div className="card mt-6 max-w-lg p-6">
          <p className="text-sm text-ink/70">Please sign in to see your orders, or contact the restaurant with your order ID.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/login" className="btn btn-primary">
              Sign in
            </Link>
            <a href={telLink(settings.phone)} className="btn btn-outline">
              Call {settings.phone}
            </a>
            <a href={whatsappLink(settings, "Hello Ravenous, I would like to track my order.")} target="_blank" rel="noreferrer" className="btn btn-outline">
              WhatsApp us
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
