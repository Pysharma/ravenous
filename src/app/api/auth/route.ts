import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { assertRateLimit, bad, clientIp, jsonError, jsonOk, route, unauth } from "@/lib/api";
import {
  clearCustomerSession,
  getCurrentUser,
  hashPassword,
  setCustomerSession,
  verifyPassword,
} from "@/lib/auth";
import { sendEmail } from "@/lib/notify";

export const dynamic = "force-dynamic";

const emailSchema = z.string().trim().toLowerCase().email("Please enter a valid email address.");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters.");
const phoneSchema = z.string().trim().regex(/^[0-9+\-\s]{8,15}$/, "Please enter a valid phone number.");

const registerSchema = z.object({
  action: z.literal("register"),
  name: z.string().trim().min(2, "Please enter your name."),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  action: z.literal("login"),
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export async function GET() {
  return route(async () => {
    const user = await getCurrentUser();
    if (!user) return jsonOk({ user: null });
    const rows = await db.execute(sql`select count(*)::int as count from notifications where audience = 'customer' and user_id = ${user.id} and is_read = false`);
    const unread = (rows.rows as { count: number }[])[0]?.count ?? 0;
    return jsonOk({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
      },
      unreadNotifications: unread,
    });
  }, "auth.me");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action;

  if (action === "logout") {
    await clearCustomerSession();
    return jsonOk({ loggedOut: true });
  }

  if (action === "register") {
    return route(async () => {
      assertRateLimit(`register:${clientIp(request)}`, 8, 15 * 60 * 1000, "Too many attempts. Please try again later.");
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) bad(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
      const data = parsed.data;
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${data.email}`)
        .limit(1);
      if (existing.length) bad("An account with this email already exists. Please sign in instead.");
      const [created] = await db
        .insert(users)
        .values({
          name: data.name,
          email: data.email,
          phone: data.phone,
          passwordHash: await hashPassword(data.password),
          status: "active",
        })
        .returning();
      await setCustomerSession(created);
      await sendEmail(created.email, "Welcome to Ravenous", `<p>Hi ${created.name}, your Ravenous account is ready. Order multi-cuisine favourites online any time.</p>`, "welcome");
      return jsonOk({ user: { id: created.id, name: created.name, email: created.email, phone: created.phone } });
    }, "auth.register");
  }

  if (action === "login") {
    return route(async () => {
      assertRateLimit(`login:${clientIp(request)}`, 10, 10 * 60 * 1000, "Too many sign-in attempts. Please wait a few minutes.");
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) bad(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
      const [user] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${parsed.data.email}`)
        .limit(1);
      if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
        return jsonError("Incorrect email or password.", 401);
      }
      if (user.status !== "active" || user.deletedAt) {
        return jsonError("This account is not active. Please contact the restaurant.", 403);
      }
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      await setCustomerSession(user);
      return jsonOk({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
    }, "auth.login");
  }

  if (action === "forgot") {
    return route(async () => {
      assertRateLimit(`forgot:${clientIp(request)}`, 5, 15 * 60 * 1000, "Too many requests. Please try again later.");
      const email = emailSchema.parse(String((body as { email?: string }).email ?? ""));
      const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
      if (!user) {
        return jsonOk({ sent: true, message: "If an account exists for that email, a reset link has been sent." });
      }
      const token = crypto.randomUUID().replace(/-/g, "");
      await db
        .update(users)
        .set({ resetToken: token, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000) })
        .where(eq(users.id, user.id));
      const link = `/reset-password?token=${token}`;
      await sendEmail(
        user.email,
        "Reset your Ravenous password",
        `<p>Hello ${user.name},</p><p>Use the link below to reset your Ravenous password. It expires in 60 minutes.</p><p><a href="${link}">${link}</a></p>`,
        "password_reset",
      );
      return jsonOk({
        sent: true,
        message: "If an account exists for that email, a reset link has been sent.",
        // Shown only when email delivery is not configured, so the flow stays testable.
        resetLink: process.env.EMAIL_API_KEY ? undefined : link,
      });
    }, "auth.forgot");
  }

  if (action === "reset") {
    return route(async () => {
      assertRateLimit(`reset:${clientIp(request)}`, 10, 15 * 60 * 1000, "Too many attempts. Please try again later.");
      const token = String((body as { token?: string }).token ?? "");
      const password = passwordSchema.parse(String((body as { password?: string }).password ?? ""));
      if (!token) bad("This reset link is not valid.");
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.resetToken, token), sql`${users.resetTokenExpiresAt} > now()`))
        .limit(1);
      if (!user) bad("This reset link is invalid or has expired.");
      await db
        .update(users)
        .set({ passwordHash: await hashPassword(password), resetToken: null, resetTokenExpiresAt: null })
        .where(eq(users.id, user.id));
      await setCustomerSession(user);
      return jsonOk({ reset: true });
    }, "auth.reset");
  }

  if (action === "update-profile") {
    return route(async () => {
      const user = await getCurrentUser();
      if (!user) unauth();
      const data = (body as { name?: string; phone?: string; avatarUrl?: string }).name
        ? {
            name: z.string().trim().min(2).parse((body as { name?: string }).name),
            phone: (body as { phone?: string }).phone ? phoneSchema.parse((body as { phone?: string }).phone) : undefined,
            avatarUrl: (body as { avatarUrl?: string }).avatarUrl,
          }
        : null;
      if (!data) bad("Nothing to update.");
      const [updated] = await db
        .update(users)
        .set({ name: data.name, phone: data.phone ?? user.phone, avatarUrl: data.avatarUrl ?? user.avatarUrl, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      return jsonOk({ user: { id: updated.id, name: updated.name, email: updated.email, phone: updated.phone } });
    }, "auth.update-profile");
  }

  if (action === "change-password") {
    return route(async () => {
      const user = await getCurrentUser();
      if (!user) unauth();
      const current = String((body as { currentPassword?: string }).currentPassword ?? "");
      const next = passwordSchema.parse(String((body as { newPassword?: string }).newPassword ?? ""));
      if (!(await verifyPassword(current, user.passwordHash))) bad("Your current password is incorrect.");
      await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
      return jsonOk({ changed: true });
    }, "auth.change-password");
  }

  return jsonError("Unsupported action.", 400);
}
