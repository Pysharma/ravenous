import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryZones } from "@/db/schema";
import { formatINR } from "@/lib/format";
import { deliverySettings, getSettings, orderingSettings, fullAddress } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery information" };

export default async function DeliveryInfoPage() {
  const settings = await getSettings();
  const delivery = deliverySettings(settings);
  const ordering = orderingSettings(settings);
  const zones = await db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true)).orderBy(asc(deliveryZones.sortOrder));

  return (
    <div className="container-page py-12">
      <p className="label">Delivery</p>
      <h1 className="font-display text-4xl">Delivery information</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/65">
        Everything below is configured by the restaurant in Delivery Settings and applied to your cart automatically.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-xl">Charges & rules</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between"><span className="text-ink/60">Delivery enabled</span><span>{delivery.enabled ? "Yes" : "No"}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Maximum delivery radius</span><span>{delivery.maxRadiusKm} km</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Base delivery fee</span><span>{formatINR(delivery.baseFee)}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Free delivery above</span><span>{delivery.freeDeliveryAbove ? formatINR(delivery.freeDeliveryAbove) : "—"}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Minimum delivery order</span><span>{formatINR(delivery.minOrderDelivery)}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Minimum pickup order</span><span>{formatINR(delivery.minOrderPickup)}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Packaging fee</span><span>{delivery.packagingFee ? formatINR(delivery.packagingFee) : "Not charged"}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Peak-hour fee</span><span>{delivery.peakHourFee ? `${formatINR(delivery.peakHourFee)} (${delivery.peakStart}–${delivery.peakEnd})` : "—"}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Cash on delivery</span><span>{delivery.codEnabled ? "Available" : "Unavailable"}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Contactless delivery</span><span>{delivery.contactlessEnabled ? "Available" : "Unavailable"}</span></li>
          </ul>
          <p className="mt-4 text-xs text-ink/50">Delivery charges are applied once per order — adding more dishes never multiplies the delivery fee.</p>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-xl">Distance slabs</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-ink/15 text-left">
                <th className="py-2">Zone</th>
                <th className="py-2">Distance</th>
                <th className="py-2 text-right">Fee</th>
                <th className="py-2 text-right">Min order</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-b border-ink/8">
                  <td className="py-2">{zone.name}</td>
                  <td className="py-2">{zone.minKm} – {zone.maxKm} km</td>
                  <td className="py-2 text-right">{formatINR(zone.fee)}</td>
                  <td className="py-2 text-right">{zone.minOrder ? formatINR(zone.minOrder) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-ink/55">
            Distances are calculated from {fullAddress(settings)} using the coordinates configured in Restaurant Settings.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-xl">Order types</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between"><span className="text-ink/60">Delivery</span><span>{ordering.deliveryEnabled ? "Enabled" : "Disabled"}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Pickup</span><span>{ordering.pickupEnabled ? "Enabled" : "Disabled"}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Dine-in & table QR</span><span>{ordering.dineInEnabled ? "Enabled" : "Disabled"}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Order scheduling</span><span>{ordering.schedulingEnabled ? `Enabled (lead time ${ordering.minLeadTimeMinutes} min)` : "Disabled"}</span></li>
            <li className="flex justify-between"><span className="text-ink/60">Cancellation window</span><span>{ordering.cancellationWindowMinutes} minutes</span></li>
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-xl">Outside our delivery area?</h2>
          <p className="mt-2 text-sm text-ink/70">
            We will tell you at checkout if your address falls outside our service radius. You can still enjoy Ravenous by booking a table or
            collecting your order.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/reservations" className="btn btn-primary">
              Dine at Ravenous
            </Link>
            <Link href="/contact" className="btn btn-outline">
              Contact Restaurant
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
