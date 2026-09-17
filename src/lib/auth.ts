import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { adminUsers, roles, users, type AdminUser, type User } from "@/db/schema";
import { forbid, unauth } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";

export const CUSTOMER_COOKIE = "rv_customer";
export const ADMIN_COOKIE = "rv_admin";
const SESSION_DAYS = 30;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET || "ravenous-local-dev-secret-key-please-change";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export async function signSession(payload: { sub: string; email: string; type: "customer" | "admin" }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function readSession(token: string | undefined, type: "customer" | "admin") {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.type !== type || !payload.sub) return null;
    return { id: Number(payload.sub), email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}

export async function setCustomerSession(user: Pick<User, "id" | "email">) {
  const token = await signSession({ sub: String(user.id), email: user.email, type: "customer" });
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearCustomerSession() {
  const store = await cookies();
  store.delete(CUSTOMER_COOKIE);
}

export async function setAdminSession(admin: Pick<AdminUser, "id" | "email">) {
  const token = await signSession({ sub: String(admin.id), email: admin.email, type: "admin" });
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const store = await cookies();
    const session = await readSession(store.get(CUSTOMER_COOKIE)?.value, "customer");
    if (!session) return null;
    const rows = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
    const user = rows[0];
    if (!user || user.status !== "active" || user.deletedAt) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) unauth();
  return user;
}

export type SessionAdmin = AdminUser & { permissions: string[]; roleName: string };

export async function getCurrentAdmin(): Promise<SessionAdmin | null> {
  try {
    const store = await cookies();
    const session = await readSession(store.get(ADMIN_COOKIE)?.value, "admin");
    if (!session) return null;
    const rows = await db
      .select({ admin: adminUsers, role: roles })
      .from(adminUsers)
      .leftJoin(roles, eq(roles.id, adminUsers.roleId))
      .where(eq(adminUsers.id, session.id))
      .limit(1);
    const row = rows[0];
    if (!row?.admin || row.admin.status !== "active") return null;
    return {
      ...row.admin,
      permissions: row.role?.permissions ?? [],
      roleName: row.role?.name ?? (row.admin.isSuperAdmin ? "Super Admin" : "Staff"),
    };
  } catch {
    return null;
  }
}

export async function requireAdmin(permission?: string | string[]): Promise<SessionAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) unauth("Admin sign-in required.");
  if (permission) {
    const perms = Array.isArray(permission) ? permission : [permission];
    if (!perms.some((p) => hasPermission(admin, p))) {
      forbid(`Your role (${admin.roleName}) cannot perform this action.`);
    }
  }
  return admin;
}
