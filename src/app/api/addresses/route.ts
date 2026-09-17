import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { bad, jsonOk, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().trim().max(20).default("Home"),
  fullName: z.string().trim().min(2, "Please enter the recipient name."),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,15}$/, "Please enter a valid phone number."),
  house: z.string().trim().max(120).optional().nullable(),
  street: z.string().trim().max(160).optional().nullable(),
  locality: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().min(2, "City is required.").default("Bilaspur"),
  state: z.string().trim().min(2).default("Chhattisgarh"),
  pincode: z.string().trim().regex(/^[0-9]{6}$/, "Enter a valid 6-digit PIN code."),
  landmark: z.string().trim().max(160).optional().nullable(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  instructions: z.string().trim().max(240).optional().nullable(),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  return route(async () => {
    const user = await getCurrentUser();
    if (!user) return jsonOk({ addresses: [] });
    const rows = await db.select().from(addresses).where(eq(addresses.userId, user.id)).orderBy(desc(addresses.isDefault), desc(addresses.id));
    return jsonOk({ addresses: rows });
  }, "addresses.list");
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await getCurrentUser();
    if (!user) bad("Please sign in to save an address.");
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) bad(parsed.error.issues[0]?.message ?? "Please check the address details.");
    const data = parsed.data;
    if (data.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
    }
    const [created] = await db
      .insert(addresses)
      .values({
        userId: user.id,
        label: data.label,
        fullName: data.fullName,
        phone: data.phone,
        house: data.house ?? null,
        street: data.street ?? null,
        locality: data.locality ?? null,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        landmark: data.landmark ?? null,
        latitude: data.latitude ? String(data.latitude) : null,
        longitude: data.longitude ? String(data.longitude) : null,
        instructions: data.instructions ?? null,
        isDefault: Boolean(data.isDefault),
      })
      .returning();
    return jsonOk({ address: created });
  }, "addresses.create");
}

export async function PUT(request: Request) {
  return route(async () => {
    const user = await getCurrentUser();
    if (!user) bad("Please sign in to update an address.");
    const body = (await request.json().catch(() => ({}))) as { id?: number; isDefault?: boolean };
    if (!body.id) bad("Address id is required.");
    if (body.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
      await db.update(addresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(addresses.id, body.id));
      return jsonOk({ updated: true });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) bad(parsed.error.issues[0]?.message ?? "Please check the address details.");
    const data = parsed.data;
    await db
      .update(addresses)
      .set({
        label: data.label,
        fullName: data.fullName,
        phone: data.phone,
        house: data.house ?? null,
        street: data.street ?? null,
        locality: data.locality ?? null,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        landmark: data.landmark ?? null,
        latitude: data.latitude ? String(data.latitude) : null,
        longitude: data.longitude ? String(data.longitude) : null,
        instructions: data.instructions ?? null,
        updatedAt: new Date(),
      })
      .where(eq(addresses.id, body.id));
    return jsonOk({ updated: true });
  }, "addresses.update");
}

export async function DELETE(request: Request) {
  return route(async () => {
    const user = await getCurrentUser();
    if (!user) bad("Please sign in to remove an address.");
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) bad("Address id is required.");
    await db.delete(addresses).where(eq(addresses.id, id));
    return jsonOk({ deleted: true });
  }, "addresses.delete");
}
