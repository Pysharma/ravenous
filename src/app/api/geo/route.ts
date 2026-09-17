import { eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses, deliveryZones } from "@/db/schema";
import { bad, jsonOk, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { fallbackGeocode, haversineKm, quoteDelivery } from "@/lib/delivery";
import { deliverySettings, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return route(async () => {
    const query = new URL(request.url).searchParams.get("q")?.trim();
    if (!query) bad("Enter an address, locality or pincode.");
    let result: { lat: number; lng: number; label: string; source: string } | null = null;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`,
        { headers: { "User-Agent": "Ravenous Restaurant Platform", Accept: "application/json" }, signal: AbortSignal.timeout(4000) },
      );
      if (response.ok) {
        const data = (await response.json()) as { lat: string; lon: string; display_name: string }[];
        if (data[0]) {
          result = { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name, source: "osm" };
        }
      }
    } catch {
      // silent – fall back to the built-in Bilaspur locality table
    }
    if (!result) {
      const local = fallbackGeocode(query);
      if (local) result = { ...local, label: query, source: "locality" };
    }
    if (!result) {
      return jsonOk({
        found: false,
        message: "We couldn't locate that address automatically. Please add the locality, city and pincode, or use your current location.",
      });
    }
    const settings = await getSettings();
    const restaurant =
      settings.latitude && settings.longitude
        ? { lat: Number(settings.latitude), lng: Number(settings.longitude) }
        : null;
    const distanceKm = restaurant ? haversineKm(restaurant, { lat: result.lat, lng: result.lng }) : null;
    return jsonOk({ found: true, ...result, distanceKm });
  }, "geo.geocode");
}

export async function POST(request: Request) {
  return route(async () => {
    const body = (await request.json().catch(() => ({}))) as {
      addressId?: number;
      latitude?: number;
      longitude?: number;
      pincode?: string;
      subtotal?: number;
      orderType?: string;
    };
    const settings = await getSettings();
    const delivery = deliverySettings(settings);
    const zones = await db.select().from(deliveryZones);
    let lat = body.latitude ?? null;
    let lng = body.longitude ?? null;
    let pincode = body.pincode ?? null;

    if (body.addressId) {
      const user = await getCurrentUser();
      if (!user) bad("Please sign in to use saved addresses.");
      const [address] = await db.select().from(addresses).where(eq(addresses.id, body.addressId)).limit(1);
      if (!address || address.userId !== user.id) bad("We could not find that address.");
      lat = address.latitude ? Number(address.latitude) : lat;
      lng = address.longitude ? Number(address.longitude) : lng;
      pincode = address.pincode;
    }

    const restaurant = settings.latitude && settings.longitude ? { lat: Number(settings.latitude), lng: Number(settings.longitude) } : null;
    const distanceKm = lat && lng && restaurant ? haversineKm(restaurant, { lat, lng }) : null;
    const quote = quoteDelivery({
      distanceKm,
      pincode,
      subtotal: body.subtotal ?? 0,
      settings: delivery,
      zones,
    });
    return jsonOk({ ...quote, restaurant });
  }, "geo.quote");
}
