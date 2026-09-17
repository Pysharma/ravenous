import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { reservations } from "@/db/schema";
import { assertRateLimit, bad, clientIp, jsonOk, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, openState, reservationSettings } from "@/lib/settings";
import { notifyAdmins, pushNotification, sendEmail } from "@/lib/notify";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,15}$/, "Please enter a valid phone number."),
  email: z.string().trim().email().optional().or(z.literal("")),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a date."),
  time: z.string().trim().regex(/^\d{2}:\d{2}$/, "Please choose a time."),
  guests: z.number().int().min(1).max(40),
  specialRequest: z.string().trim().max(300).optional().nullable(),
});

export async function GET() {
  return route(async () => {
    const user = await getCurrentUser();
    if (!user) return jsonOk({ reservations: [] });
    const rows = await db
      .select()
      .from(reservations)
      .where(eq(reservations.userId, user.id))
      .orderBy(desc(reservations.date), desc(reservations.time));
    return jsonOk({ reservations: rows });
  }, "reservations.list");
}

export async function POST(request: Request) {
  return route(async () => {
    assertRateLimit(`reservation:${clientIp(request)}`, 6, 60 * 60 * 1000, "Too many reservation requests. Please call the restaurant.");
    const settings = await getSettings();
    const config = reservationSettings(settings);
    if (!config.enabled) bad("Table reservations are currently closed. Please call the restaurant.");
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) bad(parsed.error.issues[0]?.message ?? "Please check the reservation details.");
    const data = parsed.data;
    const user = await getCurrentUser();

    if (data.guests < config.minGuests || data.guests > config.maxGuests) {
      bad(`We accept reservations for ${config.minGuests}–${config.maxGuests} guests online. Please call us for larger groups.`);
    }
    if (config.blackoutDates?.split(",").map((d) => d.trim()).includes(data.date)) {
      bad("We are unable to take reservations on that date. Please choose another day.");
    }
    const target = new Date(`${data.date}T${data.time}:00`);
    if (Number.isNaN(target.getTime())) bad("Please choose a valid date and time.");
    if (target.getTime() < Date.now()) bad("Please choose a future date and time.");
    const maxDays = config.maxDaysAhead ?? 30;
    if (target.getTime() > Date.now() + maxDays * 86400000) {
      bad(`Reservations open up to ${maxDays} days in advance.`);
    }
    const slots = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reservations)
      .where(
        and(
          eq(reservations.date, data.date),
          eq(reservations.time, data.time),
          sql`${reservations.status} not in ('cancelled','rejected','no_show')`,
        ),
      );
    if ((slots[0]?.count ?? 0) >= (config.maxPerSlot ?? 6)) {
      bad("That slot is fully booked. Please choose another time.");
    }

    const code = `RSV-${Math.floor(100000 + Math.random() * 899999)}`;
    const [created] = await db
      .insert(reservations)
      .values({
        code,
        userId: user?.id ?? null,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        date: data.date,
        time: data.time,
        guests: data.guests,
        specialRequest: data.specialRequest ?? null,
        status: config.autoConfirm ? "confirmed" : "requested",
      })
      .returning();

    await notifyAdmins(
      "New table reservation",
      `${data.name} · ${data.guests} guests · ${data.date} ${data.time}`,
      "/admin/reservations",
      "reservation",
    );
    await pushNotification({
      audience: "customer",
      userId: user?.id ?? null,
      type: "reservation",
      title: created.status === "confirmed" ? `Table confirmed · ${code}` : `Reservation requested · ${code}`,
      body: `${data.date} at ${data.time} for ${data.guests} guests`,
      link: "/account/reservations",
    });
    if (data.email) {
      await sendEmail(
        data.email,
        created.status === "confirmed" ? `Table confirmed — ${settings.name}` : `Reservation received — ${settings.name}`,
        `<p>Hi ${data.name},</p><p>Your reservation <strong>${code}</strong> for ${data.guests} guests on ${data.date} at ${data.time} is ${
          created.status === "confirmed" ? "confirmed" : "awaiting confirmation"
        }.</p><p>${settings.name}, ${settings.phone}</p>`,
        "reservation_customer",
      );
    }
    return jsonOk({ reservation: created });
  }, "reservations.create");
}

export async function PATCH(request: Request) {
  return route(async () => {
    const user = await getCurrentUser();
    if (!user) bad("Please sign in to manage reservations.");
    const body = (await request.json().catch(() => ({}))) as { id?: number; action?: string };
    if (!body.id) bad("Reservation id is required.");
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, body.id)).limit(1);
    if (!reservation || reservation.userId !== user.id) bad("We could not find that reservation on your account.");
    await db.update(reservations).set({ status: "cancelled", updatedAt: new Date() }).where(eq(reservations.id, reservation.id));
    await notifyAdmins("Reservation cancelled", `${reservation.name} · ${reservation.date} ${reservation.time}`, "/admin/reservations", "reservation");
    return jsonOk({ cancelled: true });
  }, "reservations.cancel");
}
