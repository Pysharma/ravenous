import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { assertRateLimit, bad, clientIp, jsonOk, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { haversineKm } from "@/lib/delivery";
import { priceCart, validateCoupon, type OrderType } from "@/lib/pricing";
import { getSettings, orderingSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  menuItemId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(1).max(30),
  addonIds: z.array(z.number().int().positive()).optional(),
  notes: z.string().max(280).nullable().optional(),
});

const bodySchema = z.object({
  action: z.enum(["quote", "coupon"]).default("quote"),
  lines: z.array(lineSchema).default([]),
  orderType: z.enum(["delivery", "pickup", "dinein"]).default("delivery"),
  couponCode: z.string().trim().max(40).nullable().optional(),
  addressId: z.number().int().positive().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  pincode: z.string().trim().max(10).nullable().optional(),
});

export async function POST(request: Request) {
  return route(async () => {
    assertRateLimit(`cart:${clientIp(request)}`, 120, 60 * 1000, "Too many requests. Please slow down.");
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) bad("We could not read your cart. Please refresh and try again.");
    const body = parsed.data;
    const user = await getCurrentUser();
    const settings = await getSettings();
    const ordering = orderingSettings(settings);

    let distanceKm: number | null = null;
    let pincode = body.pincode ?? null;
    let addressSnapshot: Record<string, unknown> | null = null;

    if (body.addressId && user) {
      const [address] = await db.select().from(addresses).where(eq(addresses.id, body.addressId)).limit(1);
      if (address && address.userId === user.id) {
        pincode = address.pincode ?? pincode;
        addressSnapshot = {
          label: address.label,
          fullName: address.fullName,
          phone: address.phone,
          house: address.house,
          street: address.street,
          locality: address.locality,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          landmark: address.landmark,
          instructions: address.instructions,
          latitude: address.latitude,
          longitude: address.longitude,
        };
        if (address.latitude && address.longitude && settings.latitude && settings.longitude) {
          distanceKm = haversineKm(
            { lat: Number(settings.latitude), lng: Number(settings.longitude) },
            { lat: Number(address.latitude), lng: Number(address.longitude) },
          );
        }
      }
    } else if (body.latitude && body.longitude && settings.latitude && settings.longitude) {
      distanceKm = haversineKm(
        { lat: Number(settings.latitude), lng: Number(settings.longitude) },
        { lat: body.latitude, lng: body.longitude },
      );
    }

    if (body.action === "coupon") {
      if (!body.couponCode) bad("Enter a coupon code.");
      const baseCart = await priceCart({
        lines: body.lines,
        orderType: body.orderType as OrderType,
        userId: user?.id ?? null,
        distanceKm,
        pincode,
      });
      const result = await validateCoupon({
        code: body.couponCode,
        subtotal: baseCart.subtotal,
        orderType: body.orderType as OrderType,
        userId: user?.id ?? null,
        itemSubtotals: baseCart.lines.map((l) => ({ menuItemId: l.menuItemId, categoryId: null, amount: l.lineSubtotal })),
      });
      return jsonOk({
        valid: result.ok,
        message: result.message,
        discount: result.discount,
        freeDelivery: result.freeDelivery,
      });
    }

    const cart = await priceCart({
      lines: body.lines,
      orderType: body.orderType as OrderType,
      couponCode: body.couponCode ?? null,
      userId: user?.id ?? null,
      distanceKm,
      pincode,
    });

    return jsonOk({
      cart: {
        ...cart,
        lines: cart.lines.map((l) => ({
          menuItemId: l.menuItemId,
          variantId: l.variantId,
          name: l.name,
          slug: l.slug,
          imageUrl: l.imageUrl,
          variantName: l.variantName,
          foodType: l.foodType,
          unitPrice: l.unitPrice,
          mrp: l.mrp,
          quantity: l.quantity,
          addons: l.addons,
          addonsTotal: l.addonsTotal,
          lineSubtotal: l.lineSubtotal,
          notes: l.notes,
          isAvailable: l.isAvailable,
          spiceLevel: l.spiceLevel,
        })),
      },
      orderTypeFlags: { delivery: ordering.deliveryEnabled, pickup: ordering.pickupEnabled, dineIn: ordering.dineInEnabled },
      addressSnapshot,
      restaurant: { latitude: settings.latitude, longitude: settings.longitude },
    });
  }, "cart.quote");
}
