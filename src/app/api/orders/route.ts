import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { addresses, orders } from "@/db/schema";
import { assertRateLimit, bad, clientIp, jsonOk, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { haversineKm } from "@/lib/delivery";
import { createOrder, etaMessage, statusLabel } from "@/lib/orders";
import { getSettings, openState } from "@/lib/settings";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lines: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        variantId: z.number().int().positive().nullable().optional(),
        quantity: z.number().int().min(1).max(30),
        addonIds: z.array(z.number().int().positive()).optional(),
        notes: z.string().max(280).nullable().optional(),
      }),
    )
    .min(1, "Your cart is empty."),
  orderType: z.enum(["delivery", "pickup", "dinein"]),
  name: z.string().trim().min(2, "Please enter your name."),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,15}$/, "Please enter a valid phone number."),
  email: z.string().trim().email().optional().or(z.literal("")),
  addressId: z.number().int().positive().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  note: z.string().max(300).optional().nullable(),
  deliveryInstructions: z.string().max(300).optional().nullable(),
  paymentMethod: z.enum(["upi", "razorpay", "cod", "counter"]),
  couponCode: z.string().trim().max(40).nullable().optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
  tableCode: z.string().trim().max(40).nullable().optional(),
  contactless: z.boolean().optional(),
});

export async function GET(request: Request) {
  return route(async () => {
    const user = await getCurrentUser();
    if (!user) return jsonOk({ orders: [] });
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt))
      .limit(limit);
    return jsonOk({
      orders: rows.map((order) => ({
        id: order.id,
        orderCode: order.orderCode,
        status: order.status,
        statusLabel: statusLabel(order.status),
        orderType: order.orderType,
        total: order.total,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        itemCount: order.itemCount,
        createdAt: order.createdAt,
        eta: etaMessage(order),
      })),
    });
  }, "orders.list");
}

export async function POST(request: Request) {
  return route(async () => {
    const ip = clientIp(request);
    assertRateLimit(`order:${ip}`, 20, 10 * 60 * 1000, "Too many order attempts. Please wait a few minutes.");
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) bad(parsed.error.issues[0]?.message ?? "Please check your order details.");
    const body = parsed.data;
    const user = await getCurrentUser();
    const settings = await getSettings();
    const state = openState(settings);

    if (!state.acceptOrders && !body.scheduledFor) {
      bad(state.bannerMessage || "We're currently closed. You can schedule your order for later.");
    }
    if (body.orderType === "delivery" && settings.status === "pickup_only") {
      bad("Ravenous is currently accepting pickup and dine-in orders only.");
    }

    let distanceKm: number | null = null;
    let pincode: string | null = null;
    let addressSnapshot: Record<string, unknown> | null = null;

    if (body.orderType === "delivery") {
      if (body.addressId) {
        if (!user) bad("Please sign in to use a saved address.");
        const [address] = await db.select().from(addresses).where(eq(addresses.id, body.addressId)).limit(1);
        if (!address || address.userId !== user.id) bad("We could not find that saved address.");
        pincode = address.pincode;
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
      } else if (body.latitude && body.longitude) {
        if (settings.latitude && settings.longitude) {
          distanceKm = haversineKm(
            { lat: Number(settings.latitude), lng: Number(settings.longitude) },
            { lat: body.latitude, lng: body.longitude },
          );
        }
        addressSnapshot = { label: "Other", fullName: body.name, phone: body.phone, latitude: body.latitude, longitude: body.longitude };
      } else {
        bad("Please add a delivery address for delivery orders.");
      }
    }

    const result = await createOrder({
      userId: user?.id ?? null,
      lines: body.lines,
      orderType: body.orderType,
      customer: {
        name: body.name,
        phone: body.phone,
        email: body.email || user?.email || null,
        addressId: body.addressId ?? null,
        addressSnapshot,
        note: body.note ?? null,
        deliveryInstructions: body.deliveryInstructions ?? null,
      },
      couponCode: body.couponCode ?? null,
      paymentMethod: body.paymentMethod,
      distanceKm,
      pincode,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      tableCode: body.tableCode ?? null,
      contactless: body.contactless,
    });

    return jsonOk({
      order: {
        id: result.order.id,
        orderCode: result.order.orderCode,
        orderType: result.order.orderType,
        status: result.order.status,
        paymentStatus: result.order.paymentStatus,
        paymentMethod: result.order.paymentMethod,
        total: result.order.total,
        itemCount: result.order.itemCount,
        prepTimeMinutes: result.order.prepTimeMinutes,
        etaMinutes: result.order.etaMinutes,
        createdAt: result.order.createdAt,
      },
      pricing: {
        subtotal: result.cart.subtotal,
        discountTotal: result.cart.discountTotal,
        taxTotal: result.cart.taxTotal,
        packagingFee: result.cart.packagingFee,
        deliveryFee: result.cart.deliveryFee,
        total: result.cart.total,
        distanceKm: result.cart.distanceKm,
        zoneName: result.cart.zoneName,
        couponMessage: result.cart.couponMessage,
      },
      nextStep: result.order.paymentMethod === "upi" || result.order.paymentMethod === "razorpay" ? "payment" : "done",
    });
  }, "orders.create");
}
