import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  restaurantSettings,
  type DayHours,
  type DeliverySettings,
  type OrderingSettings,
  type PaymentSettings,
  type ReservationSettings,
  type RestaurantSettings,
  type TaxSettings,
} from "@/db/schema";
import { isWithinWindow } from "@/lib/delivery";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const DEFAULT_HOURS: DayHours[] = DAYS.map((day) => ({
  day,
  open: "11:00",
  close: "23:00",
  closed: false,
}));

export const DEFAULT_DELIVERY: DeliverySettings = {
  enabled: true,
  maxRadiusKm: 10,
  baseFee: 3000,
  minOrderDelivery: 19900,
  minOrderPickup: 14900,
  freeDeliveryAbove: 79900,
  peakHourFee: 2000,
  peakStart: "19:30",
  peakEnd: "21:30",
  packagingFee: 1500,
  packagingPerItem: false,
  codEnabled: true,
  minOrderCod: 19900,
  maxOrderCod: 500000,
  contactlessEnabled: true,
  driverAssignEnabled: true,
};

export const DEFAULT_TAX: TaxSettings = {
  gstEnabled: true,
  defaultRate: 5,
  packagingTaxRate: 0,
  deliveryTaxRate: 0,
  pricesIncludeTax: false,
};

export const DEFAULT_PAYMENT: PaymentSettings = {
  onlineEnabled: true,
  upiEnabled: true,
  cardEnabled: true,
  netbankingEnabled: true,
  walletEnabled: true,
  codEnabled: true,
  payAtRestaurant: true,
  razorpayMode: "test",
  upiId: "ravenous@upi",
};

export const DEFAULT_RESERVATION: ReservationSettings = {
  enabled: true,
  openTime: "12:00",
  closeTime: "22:30",
  slotMinutes: 60,
  maxPerSlot: 6,
  minGuests: 1,
  maxGuests: 20,
  autoConfirm: false,
  blackoutDates: "",
  maxDaysAhead: 30,
};

export const DEFAULT_ORDERING: OrderingSettings = {
  deliveryEnabled: true,
  pickupEnabled: true,
  dineInEnabled: true,
  schedulingEnabled: true,
  minLeadTimeMinutes: 45,
  maxScheduleDays: 7,
  cancellationWindowMinutes: 10,
  allowCancelAfterPrep: false,
  tableQrEnabled: true,
  reviewsRequireApproval: true,
  quickAddEnabled: true,
  supportPhone: "093039 73399",
};

export const SETTINGS_FALLBACK: RestaurantSettings = {
  id: 1,
  name: "Ravenous Multi Cuisine Restaurant",
  shortName: "Ravenous",
  tagline: "Multi Cuisine Restaurant",
  brandMessage: "Good Food. Great Vibes. Made for Every Craving.",
  brandSubtext:
    "Discover delicious multi-cuisine favourites, freshly prepared and delivered to your doorstep—or enjoy them at Ravenous.",
  logoUrl: null,
  faviconUrl: null,
  addressLine: "Ring Road No-2, Gaurav Path, Kalindi Kunj, Jarahbhata",
  city: "Bilaspur",
  state: "Chhattisgarh",
  pincode: "495001",
  country: "India",
  phone: "093039 73399",
  altPhone: null,
  whatsapp: "919303973399",
  email: "hello@ravenous.example",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Ravenous+Multi+Cuisine+Restaurant+Bilaspur",
  latitude: "22.0849",
  longitude: "82.1514",
  priceRange: "₹200–₹1,200 per person",
  publicRating: "4.5",
  publicReviewCount: 1129,
  services: "Dine-in, Delivery, Drive-through",
  shortDescription:
    "A multi cuisine restaurant in Bilaspur serving Indian, Chinese and continental favourites.",
  aboutText:
    "Ravenous Multi Cuisine Restaurant brings together a wide variety of flavours in one welcoming destination in Bilaspur. From satisfying meals and biryanis to Chinese favourites, refreshing drinks and more, Ravenous is designed for every kind of craving.",
  aboutImageUrl: null,
  heroImageUrl: null,
  galleryHeading: "Inside Ravenous",
  gstNumber: null,
  fssaiNumber: null,
  invoiceFooter: "Thank you for ordering from Ravenous.",
  status: "open",
  statusMessage: null,
  busyExtraMinutes: 0,
  hours: DEFAULT_HOURS,
  weeklyHoliday: null,
  social: { instagram: "", facebook: "" },
  delivery: DEFAULT_DELIVERY,
  tax: DEFAULT_TAX,
  payment: DEFAULT_PAYMENT,
  reservation: DEFAULT_RESERVATION,
  ordering: DEFAULT_ORDERING,
  updatedAt: new Date(),
};

export async function getSettings(): Promise<RestaurantSettings> {
  try {
    const rows = await db.select().from(restaurantSettings).where(eq(restaurantSettings.id, 1)).limit(1);
    if (rows[0]) {
      return {
        ...rows[0],
        hours: rows[0].hours?.length ? rows[0].hours : DEFAULT_HOURS,
      };
    }
  } catch {
    // database not reachable yet – fall back to defaults so the site still renders
  }
  return SETTINGS_FALLBACK;
}

export function deliverySettings(settings: RestaurantSettings): DeliverySettings {
  return { ...DEFAULT_DELIVERY, ...(settings.delivery ?? {}) };
}
export function taxSettings(settings: RestaurantSettings): TaxSettings {
  return { ...DEFAULT_TAX, ...(settings.tax ?? {}) };
}
export function paymentSettings(settings: RestaurantSettings): PaymentSettings {
  return { ...DEFAULT_PAYMENT, ...(settings.payment ?? {}) };
}
export function reservationSettings(settings: RestaurantSettings): ReservationSettings {
  return { ...DEFAULT_RESERVATION, ...(settings.reservation ?? {}) };
}
export function orderingSettings(settings: RestaurantSettings): OrderingSettings {
  return { ...DEFAULT_ORDERING, ...(settings.ordering ?? {}) };
}
export function hoursOf(settings: RestaurantSettings): DayHours[] {
  return settings.hours?.length ? settings.hours : DEFAULT_HOURS;
}

export function fullAddress(settings: RestaurantSettings, multiline = false): string {
  const parts = [
    settings.addressLine,
    `${settings.city}, ${settings.state} ${settings.pincode}`,
    settings.country,
  ].filter(Boolean);
  return multiline ? parts.join(", ") : parts.join(", ");
}

export function directionsUrl(settings: RestaurantSettings): string {
  if (settings.mapsUrl) return settings.mapsUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${settings.name} ${fullAddress(settings)}`,
  )}`;
}

export function whatsappLink(settings: RestaurantSettings, message?: string): string {
  const number = (settings.whatsapp || settings.phone || "").replace(/\D/g, "");
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function telLink(phone: string): string {
  return `tel:${phone.replace(/\s/g, "")}`;
}

export type OpenState = {
  open: boolean;
  reason?: string;
  bannerMessage?: string;
  acceptOrders: boolean;
  canSchedule: boolean;
  todayHours?: DayHours;
};

export function openState(settings: RestaurantSettings, at = new Date()): OpenState {
  const hours = hoursOf(settings);
  const dayIndex = (at.getDay() + 6) % 7; // Monday = 0
  const today = hours[dayIndex];
  const base: OpenState = {
    open: true,
    acceptOrders: true,
    canSchedule: false,
    todayHours: today,
  };

  if (settings.status === "closed" || settings.status === "temporarily_closed") {
    return {
      ...base,
      open: false,
      acceptOrders: false,
      canSchedule: true,
      bannerMessage: settings.statusMessage || "We're currently closed. You can schedule your order for later.",
    };
  }
  if (settings.status === "busy") {
    return {
      ...base,
      bannerMessage:
        settings.statusMessage ||
        "Ravenous is currently busy. Delivery orders may take longer than usual.",
    };
  }
  if (settings.status === "delivery_paused") {
    return {
      ...base,
      bannerMessage: settings.statusMessage || "Delivery is paused right now. Pickup and dine-in are available.",
    };
  }
  if (settings.status === "pickup_only") {
    return {
      ...base,
      bannerMessage: settings.statusMessage || "Currently accepting pickup and dine-in orders only.",
    };
  }
  if (!today || today.closed || (settings.weeklyHoliday && settings.weeklyHoliday === today.day)) {
    return {
      ...base,
      open: false,
      acceptOrders: false,
      canSchedule: true,
      bannerMessage: "We're closed today. You can schedule your order for later.",
    };
  }
  const within = isWithinWindow(at, today.open, today.close);
  if (!within) {
    return {
      ...base,
      open: false,
      acceptOrders: false,
      canSchedule: true,
      bannerMessage: `We're currently closed (hours ${today.open} – ${today.close}). You can schedule your order for later.`,
    };
  }
  return base;
}

export function todayHoursLabel(settings: RestaurantSettings, at = new Date()): string {
  const hours = hoursOf(settings);
  const dayIndex = (at.getDay() + 6) % 7;
  const today = hours[dayIndex];
  if (!today || today.closed) return "Closed today";
  return `${today.open} – ${today.close}`;
}
