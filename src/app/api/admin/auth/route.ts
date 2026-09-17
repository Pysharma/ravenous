import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers, roles } from "@/db/schema";
import { assertRateLimit, bad, clientIp, jsonError, jsonOk, route, writeAudit } from "@/lib/api";
import { clearAdminSession, getCurrentAdmin, setAdminSession, verifyPassword, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return route(async () => {
    const admin = await getCurrentAdmin();
    if (!admin) return jsonOk({ admin: null });
    return jsonOk({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
        roleName: admin.roleName,
        permissions: admin.permissions,
      },
    });
  }, "admin.auth.me");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { action?: string; email?: string; password?: string };

  if (body.action === "logout") {
    await clearAdminSession();
    return jsonOk({ loggedOut: true });
  }

  if (body.action === "login") {
    return route(async () => {
      assertRateLimit(`admin-login:${clientIp(request)}`, 8, 10 * 60 * 1000, "Too many sign-in attempts. Please wait a few minutes.");
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!email || !password) bad("Enter your email and password.");
      const [row] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
      if (!row || !(await verifyPassword(password, row.passwordHash))) {
        return jsonError("Incorrect email or password.", 401);
      }
      if (row.status !== "active") return jsonError("This admin account has been disabled.", 403);
      await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, row.id));
      await setAdminSession(row);
      await writeAudit({
        adminId: row.id,
        actorName: row.name,
        action: "admin.login",
        entity: "admin_users",
        entityId: row.id,
        summary: `${row.name} signed in to the admin dashboard`,
        ip: clientIp(request),
      });
      const [role] = row.roleId ? await db.select().from(roles).where(eq(roles.id, row.roleId)).limit(1) : [];
      return jsonOk({
        admin: { id: row.id, name: row.name, email: row.email, isSuperAdmin: row.isSuperAdmin, roleName: role?.name ?? "Staff" },
      });
    }, "admin.auth.login");
  }

  if (body.action === "change-password") {
    return route(async () => {
      const admin = await getCurrentAdmin();
      if (!admin) return jsonError("Admin sign-in required.", 401);
      const current = String((body as { currentPassword?: string }).currentPassword ?? "");
      const next = String((body as { newPassword?: string }).newPassword ?? "");
      if (next.length < 8) bad("New password must be at least 8 characters.");
      if (!(await verifyPassword(current, admin.passwordHash))) bad("Your current password is incorrect.");
      await db.update(adminUsers).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(adminUsers.id, admin.id));
      await writeAudit({ adminId: admin.id, actorName: admin.name, action: "admin.password_changed", entity: "admin_users", entityId: admin.id, summary: "Password updated" });
      return jsonOk({ changed: true });
    }, "admin.auth.change-password");
  }

  return jsonError("Unsupported action.", 400);
}
