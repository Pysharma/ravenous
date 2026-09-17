import type { DeliverySettings, DeliveryZone, OrderingSettings } from "@/db/schema";

export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
}

/** Bilaspur-area fallback coordinates so quoting keeps working without a geocoding key. */
export const LOCALITY_COORDS: { name: string; pincode: string; lat: number; lng: number }[] = [
  { name: "Kalindi Kunj, Jarahbhata", pincode: "495001", lat: 22.0849, lng: 82.1514 },
  { name: "Gaurav Path Ring Road No-2", pincode: "495001", lat: 22.0841, lng: 82.1503 },
  { name: "Vyapar Vihar", pincode: "495001", lat: 22.0871, lng: 82.1401 },
  { name: "Mangal Chowk", pincode: "495001", lat: 22.0803, lng: 82.1547 },
  { name: "Bus Stand Bilaspur", pincode: "495001", lat: 22.0769, lng: 82.1511 },
  { name: "Gol Bazar", pincode: "495001", lat: 22.0794, lng: 82.1479 },
  { name: "Sarkanda", pincode: "495006", lat: 22.0977, lng: 82.1501 },
  { name: "Tifra", pincode: "495006", lat: 22.1088, lng: 82.1382 },
  { name: "Vidya Nagar", pincode: "495001", lat: 22.0942, lng: 82.1623 },
  { name: "Nehru Nagar", pincode: "495001", lat: 22.0734, lng: 82.1601 },
  { name: "Bilaspur Railway Station", pincode: "495004", lat: 22.0603, lng: 82.1642 },
  { name: "Sirgitti", pincode: "495004", lat: 22.0611, lng: 82.1791 },
  { name: "Ratanpur Road", pincode: "495001", lat: 22.0935, lng: 82.1811 },
  { name: "Sendri", pincode: "495006", lat: 22.1186, lng: 82.1284 },
  { name: "Koni", pincode: "495009", lat: 22.0985, lng: 82.1226 },
  { name: "Deepika", pincode: "495001", lat: 22.0701, lng: 82.1421 },
];

export function fallbackGeocode(query: string): { lat: number; lng: number } | null {
  const needle = query.toLowerCase();
  const pincodeMatch = needle.match(/\b(49\d{4})\b/);
  if (pincodeMatch) {
    const hit = LOCALITY_COORDS.find((l) => l.pincode === pincodeMatch[1]);
    if (hit) return { lat: hit.lat, lng: hit.lng };
  }
  const found = LOCALITY_COORDS.find(
    (l) => needle.includes(l.name.split(",")[0].toLowerCase()) || l.name.toLowerCase().includes(needle.trim()),
  );
  return found ? { lat: found.lat, lng: found.lng } : null;
}

export type DeliveryQuote = {
  serviceable: boolean;
  distanceKm: number | null;
  feePaise: number;
  zoneName: string | null;
  minOrderPaise: number;
  message?: string;
};

export function quoteDelivery(input: {
  distanceKm?: number | null;
  pincode?: string | null;
  subtotal: number;
  settings: DeliverySettings;
  zones: DeliveryZone[];
  at?: Date;
}): DeliveryQuote {
  const { distanceKm = null, pincode, subtotal, settings, zones } = input;
  const minOrderPaise = settings.minOrderDelivery ?? 0;
  const activeZones = zones
    .filter((z) => z.isActive)
    .slice()
    .sort((a, b) => a.minKm - b.minKm);

  if (!settings.enabled) {
    return {
      serviceable: false,
      distanceKm,
      feePaise: 0,
      zoneName: null,
      minOrderPaise,
      message: "Delivery is currently unavailable. You can still place a pickup or dine-in order.",
    };
  }

  let zone: DeliveryZone | null = null;
  if (distanceKm !== null) {
    if (distanceKm > (settings.maxRadiusKm || 10)) {
      return {
        serviceable: false,
        distanceKm,
        feePaise: 0,
        zoneName: null,
        minOrderPaise,
        message: "We're sorry, Ravenous currently doesn't deliver to this location.",
      };
    }
    zone = activeZones.find((z) => distanceKm >= z.minKm && distanceKm <= z.maxKm) ?? null;
  } else if (pincode && activeZones.some((z) => z.pincodes)) {
    zone = activeZones.find((z) => z.pincodes.split(",").map((p) => p.trim()).includes(pincode)) ?? null;
    if (!zone) {
      return {
        serviceable: false,
        distanceKm: null,
        feePaise: 0,
        zoneName: null,
        minOrderPaise,
        message: "We're sorry, Ravenous currently doesn't deliver to this location.",
      };
    }
  }

  if (!zone) {
    // No coordinates and no pincode mapping: fall back to base fee inside radius.
    zone = activeZones.find((z) => z.minKm === 0) ?? activeZones[0] ?? null;
  }

  let fee = zone && zone.fee > 0 ? zone.fee : settings.baseFee ?? 0;
  if (distanceKm !== null && zone && zone.extraPerKm > 0 && distanceKm > zone.maxKm) {
    fee += Math.round((distanceKm - zone.maxKm) * zone.extraPerKm);
  }
  if (settings.peakStart && settings.peakEnd && isWithinWindow(input.at ?? new Date(), settings.peakStart, settings.peakEnd)) {
    fee += settings.peakHourFee ?? 0;
  }
  const freeAbove = settings.freeDeliveryAbove ?? 0;
  if (freeAbove > 0 && subtotal >= freeAbove) fee = 0;

  return {
    serviceable: true,
    distanceKm,
    feePaise: fee,
    zoneName: zone?.name ?? null,
    minOrderPaise: zone?.minOrder && zone.minOrder > minOrderPaise ? zone.minOrder : minOrderPaise,
  };
}

export function isWithinWindow(at: Date, start: string, end: string): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map((n) => Number(n));
    return (h || 0) * 60 + (m || 0);
  };
  const nowMinutes = at.getHours() * 60 + at.getMinutes();
  const s = toMinutes(start);
  const e = toMinutes(end);
  return s <= e ? nowMinutes >= s && nowMinutes <= e : nowMinutes >= s || nowMinutes <= e;
}

export function packagingFeeFor(itemCount: number, settings: DeliverySettings): number {
  const fee = settings.packagingFee ?? 0;
  if (!fee) return 0;
  return settings.packagingPerItem ? fee * Math.max(itemCount, 0) : fee;
}

export function orderingFlags(ordering: Partial<OrderingSettings> | null | undefined) {
  return {
    delivery: ordering?.deliveryEnabled ?? true,
    pickup: ordering?.pickupEnabled ?? true,
    dineIn: ordering?.dineInEnabled ?? true,
  };
}
