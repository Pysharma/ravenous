import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { formatINR } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offers & promotions" };

export default async function OffersPage() {
  const settings = await getSettings();
  const active = await db.select().from(coupons).where(eq(coupons.isActive, true)).orderBy(desc(coupons.id));

  return (
    <div>
      <section className="bg-ink py-12 text-cream">
        <div className="container-page">
          <p className="label !text-gold">Offers & promotions</p>
          <h1 className="font-display text-4xl">Save on your next craving</h1>
          <p className="mt-3 max-w-2xl text-sm text-cream/75">
            Apply a coupon at checkout. Every offer is validated on our servers — expired, duplicate or ineligible coupons are never applied.
          </p>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((coupon) => (
            <article key={coupon.id} className="card flex flex-col p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl text-ember">{coupon.code}</span>
                <span className="badge badge-gold">
                  {coupon.discountType === "percent"
                    ? `${coupon.discountValue}% OFF`
                    : coupon.discountType === "fixed"
                      ? `${formatINR(coupon.discountValue)} OFF`
                      : "FREE DELIVERY"}
                </span>
              </div>
              <p className="mt-2 font-medium">{coupon.name}</p>
              <ul className="mt-3 space-y-1 text-xs text-ink/60">
                {coupon.minOrder ? <li>Minimum order {formatINR(coupon.minOrder)}</li> : null}
                {coupon.maxDiscount ? <li>Maximum discount {formatINR(coupon.maxDiscount)}</li> : null}
                {coupon.startTime && coupon.endTime ? <li>Valid {coupon.startTime} – {coupon.endTime}</li> : null}
                {coupon.firstOrderOnly ? <li>First order only</li> : null}
                <li>Per customer limit: {coupon.perUserLimit === 0 ? "unlimited" : coupon.perUserLimit}</li>
                {coupon.orderTypes ? <li>Order types: {coupon.orderTypes}</li> : null}
                {coupon.isDemoData ? <li className="text-ink/45">Demo offer created for this demo dataset</li> : null}
              </ul>
              <Link href="/menu" className="btn btn-primary mt-4">
                Use this offer
              </Link>
            </article>
          ))}
          {!active.length ? (
            <p className="text-sm text-ink/60">
              No offers are active right now. The restaurant can publish new coupons from the admin dashboard at any time.
            </p>
          ) : null}
        </div>

        <div className="card mt-10 p-6">
          <h2 className="font-display text-2xl">Happy hours & time-based promotions</h2>
          <p className="mt-2 text-sm text-ink/65">
            Time-based offers (for example 16:00 – 18:00 on selected categories) are configured by the restaurant in Offers &amp; Coupons and are
            automatically validated against the current time at checkout.
          </p>
          <p className="mt-3 text-xs text-ink/50">
            Free delivery above {formatINR(settings.delivery?.freeDeliveryAbove ?? 0)} and other delivery rules are configurable in Delivery
            Settings.
          </p>
        </div>
      </section>
    </div>
  );
}
