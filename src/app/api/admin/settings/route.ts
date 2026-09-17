import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { restaurantSettings, type DayHours } from "@/db/schema";
import { bad, jsonOk, route, writeAudit } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_HOURS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const scalarSchema = z.object({
  name: z.string().trim().min(2).optional(),
  shortName: z.string().trim().min(1).optional(),
  tagline: z.string().trim().optional(),
  brandMessage: z.string().trim().optional(),
  brandSubtext: z.string().trim().optional(),
  logoUrl: z.string().trim().nullable().optional(),
  faviconUrl: z.string().trim().nullable().optional(),
  addressLine: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  altPhone: z.string().trim().nullable().optional(),
  whatsapp: z.string().trim().optional(),
  email: z.string().trim().optional(),
  mapsUrl: z.string().trim().nullable().optional(),
  latitude: z.string().trim().nullable().optional(),
  longitude: z.string().trim().nullable().optional(),
  priceRange: z.string().trim().optional(),
  publicRating: z.string().trim().optional(),
  publicReviewCount: z.number().int().optional(),
  services: z.string().trim().optional(),
  shortDescription: z.string().trim().optional(),
  aboutText: z.string().trim().optional(),
  aboutImageUrl: z.string().trim().nullable().optional(),
  heroImageUrl: z.string().trim().nullable().optional(),
  galleryHeading: z.string().trim().optional(),
  gstNumber: z.string().trim().nullable().optional(),
  fssaiNumber: z.string().trim().nullable().optional(),
  invoiceFooter: z.string().trim().optional(),
  status: z.enum(["open", "closed", "temporarily_closed", "busy", "pickup_only", "delivery_paused"]).optional(),
  statusMessage: z.string().trim().nullable().optional(),
  busyExtraMinutes: z.number().int().min(0).max(120).optional(),
  weeklyHoliday: z.string().trim().nullable().optional(),
});

export async function GET() {
  return route(async () => {
    await requireAdmin("settings.manage");
    const settings = await getSettings();
    return jsonOk({ settings });
  }, "admin.settings.get");
}

export async function PATCH(request: Request) {
  return route(async () => {
    const admin = await requireAdmin("settings.manage");
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = scalarSchema.partial().safeParse(body);
    if (!parsed.success) bad(parsed.error.issues[0]?.message ?? "Please check the settings values.");

    const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (Array.isArray(body.hours)) {
      const hours = (body.hours as DayHours[]).map((day) => ({
        day: String(day.day),
        open: String(day.open ?? "11:00"),
        close: String(day.close ?? "23:00"),
        closed: Boolean(day.closed),
        special: day.special ? String(day.special) : undefined,
      }));
      patch.hours = hours.length ? hours : DEFAULT_HOURS;
    }
    for (const group of ["delivery", "tax", "payment", "reservation", "ordering", "social"] as const) {
      if (body[group] && typeof body[group] === "object") {
        const existing = await getSettings();
        patch[group] = { ...(existing[group] as object), ...(body[group] as object) };
      }
    }

    const current = await db.select({ id: restaurantSettings.id }).from(restaurantSettings).limit(1);
    if (!current.length) {
      await db.insert(restaurantSettings).values({ id: 1, ...patch } as never);
    } else {
      await db.update(restaurantSettings).set(patch as never).where(eq(restaurantSettings.id, 1));
    }
    await writeAudit({
      adminId: admin.id,
      actorName: admin.name,
      action: "settings.updated",
      entity: "restaurant_settings",
      entityId: 1,
      summary: `Updated restaurant settings (${Object.keys(patch).filter((k) => k !== "updatedAt").join(", ")})`,
      meta: patch,
    });
    const settings = await getSettings();
    return jsonOk({ settings });
  }, "admin.settings.update");
}
