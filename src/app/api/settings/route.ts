import { jsonOk, route } from "@/lib/api";
import {
  deliverySettings,
  fullAddress,
  getSettings,
  hoursOf,
  openState,
  orderingSettings,
  paymentSettings,
  reservationSettings,
  taxSettings,
  todayHoursLabel,
  directionsUrl,
} from "@/lib/settings";
import { integrationStatus } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET() {
  return route(async () => {
    const settings = await getSettings();
    const state = openState(settings);
    return jsonOk({
      settings: {
        name: settings.name,
        shortName: settings.shortName,
        tagline: settings.tagline,
        brandMessage: settings.brandMessage,
        brandSubtext: settings.brandSubtext,
        phone: settings.phone,
        altPhone: settings.altPhone,
        whatsapp: settings.whatsapp,
        email: settings.email,
        address: fullAddress(settings),
        city: settings.city,
        state: settings.state,
        pincode: settings.pincode,
        priceRange: settings.priceRange,
        publicRating: settings.publicRating,
        publicReviewCount: settings.publicReviewCount,
        services: settings.services,
        status: settings.status,
        statusMessage: state.bannerMessage ?? null,
        latitude: settings.latitude,
        longitude: settings.longitude,
        mapsUrl: directionsUrl(settings),
        heroImageUrl: settings.heroImageUrl,
        hours: hoursOf(settings),
        social: settings.social ?? {},
      },
      open: {
        open: state.open,
        acceptOrders: state.acceptOrders,
        canSchedule: state.canSchedule,
        message: state.bannerMessage ?? null,
        todayHours: todayHoursLabel(settings),
      },
      delivery: deliverySettings(settings),
      tax: taxSettings(settings),
      payment: paymentSettings(settings),
      reservation: reservationSettings(settings),
      ordering: orderingSettings(settings),
      integrations: integrationStatus(),
    });
  }, "settings.public");
}
