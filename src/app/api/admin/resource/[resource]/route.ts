import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { menuItemAddons, menuItems, menuVariants } from "@/db/schema";
import { bad, jsonError, jsonOk, route, writeAudit } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getResource, tableColumns, type ResourceDef } from "@/lib/adminResources";
import { slugify } from "@/lib/format";

export const dynamic = "force-dynamic";

function coerce(def: ResourceDef, key: string, value: unknown) {
  const field = def.fields.find((f) => f.key === key);
  if (!field) return undefined;
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  switch (field.type) {
    case "money": {
      const n = Number(String(value).replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? Math.round(n * 100) : 0;
    }
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? Math.round(n) : 0;
    }
    case "boolean":
    case "select":
      if (field.type === "boolean" || field.key === "isActive" || field.key === "isAvailable" || field.key === "isPublished" || field.key === "isSuperAdmin") {
        return value === true || value === "true";
      }
      return String(value);
    case "date":
      return new Date(String(value));
    case "datetime":
      return value ? new Date(String(value)) : null;
    case "permissions":
      return Array.isArray(value) ? value.map(String) : String(value).split(",").filter(Boolean);
    default:
      return String(value);
  }
}

function selectColumnType(def: ResourceDef, key: string) {
  const field = def.fields.find((f) => f.key === key);
  if (!field) return "text" as const;
  if (field.type === "money" || field.type === "number") return "number" as const;
  return "text" as const;
}

export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const def = getResource(resource);
  if (!def) return jsonError("Unknown resource.", 404);
  return route(async () => {
    await requireAdmin(def.viewPermission);
    const url = new URL(request.url);
    const search = url.searchParams.get("q")?.trim();
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const perPage = Math.min(Math.max(Number(url.searchParams.get("perPage") ?? 50), 1), 500);
    const cols = tableColumns(def) as Record<string, never>;
    const conditions: unknown[] = [];
    if (search && def.searchColumns.length) {
      const parts = def.searchColumns
        .filter((c) => cols[c])
        .map((c) => ilike(cols[c], `%${search}%`));
      if (parts.length) conditions.push(or(...parts));
    }
    const where = conditions.length ? and(...(conditions as never[])) : undefined;
    const orderColumn = cols[def.orderBy.column];
    const rows = await db
      .select()
      .from(def.table)
      .where(where)
      .orderBy(def.orderBy.dir === "asc" ? asc(orderColumn) : desc(orderColumn))
      .limit(perPage)
      .offset((page - 1) * perPage);
    const totalRows = await db.select({ count: sql<number>`count(*)::int` }).from(def.table).where(where);
    const sanitized = rows.map((row) => {
      const clone: Record<string, unknown> = { ...(row as Record<string, unknown>) };
      delete clone.passwordHash;
      delete clone.resetToken;
      delete clone.resetTokenExpiresAt;
      return clone;
    });
    return jsonOk({ rows: sanitized, total: totalRows[0]?.count ?? 0, page, perPage, schema: def.fields, columnTypes: Object.fromEntries(def.fields.map((f) => [f.key, selectColumnType(def, f.key)])) });
  }, `admin.resource.${resource}.list`);
}

export async function POST(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const def = getResource(resource);
  if (!def) return jsonError("Unknown resource.", 404);
  if (def.creatable === false) return jsonError("This resource is created automatically.", 400);
  return route(async () => {
    const admin = await requireAdmin(def.managePermission);
    const body = (await request.json()) as Record<string, unknown>;
    const values: Record<string, unknown> = { ...def.defaults };
    for (const field of def.fields) {
      if (field.readOnly) continue;
      if (field.type === "password") continue;
      if (body[field.key] === undefined) continue;
      const coerced = coerce(def, field.key, body[field.key]);
      if (coerced !== undefined) values[field.key] = coerced;
    }
    if (values.name && !values.slug && (def.key === "categories" || def.key === "menu-items" || def.key === "roles")) {
      values.slug = slugify(String(values.name));
    }
    if (def.key === "coupons" && values.code) values.code = String(values.code).toUpperCase();
    if (def.key === "admins") {
      const password = typeof body.password === "string" && body.password.length >= 8 ? body.password : null;
      if (!password) bad("Admin password must be at least 8 characters.");
      const { hashPassword } = await import("@/lib/auth");
      values.passwordHash = await hashPassword(password);
    }
    const [created] = await db.insert(def.table).values(values as never).returning();
    const id = (created as Record<string, unknown>).id as number;

    if (def.key === "menu-items") {
      await syncMenuNested(id, body);
    }

    await writeAudit({
      adminId: admin.id,
      actorName: admin.name,
      action: `${def.key}.created`,
      entity: def.key,
      entityId: id,
      summary: `Created ${def.singular.toLowerCase()} ${String(values.name ?? (created as { code?: string }).code ?? id)}`,
      meta: { values },
    });
    const clone: Record<string, unknown> = { ...(created as Record<string, unknown>) };
    delete clone.passwordHash;
    return jsonOk({ row: clone });
  }, `admin.resource.${resource}.create`);
}

async function syncMenuNested(menuItemId: number, body: Record<string, unknown>) {
  const variants = Array.isArray(body.variants) ? (body.variants as Record<string, unknown>[]) : null;
  const addonIds = Array.isArray(body.addonIds) ? (body.addonIds as (number | string)[]).map(Number) : null;
  if (variants) {
    await db.delete(menuVariants).where(eq(menuVariants.menuItemId, menuItemId));
    const rows = variants
      .filter((v) => v.name)
      .map((v, index) => ({
        menuItemId,
        name: String(v.name),
        price: Math.round(Number(v.price ?? 0) * 100),
        mrp: Math.round(Number(v.mrp ?? v.price ?? 0) * 100),
        stock: Number(v.stock ?? -1),
        prepTimeMinutes: Number(v.prepTimeMinutes ?? 0),
        isAvailable: v.isAvailable !== false,
        isDefault: Boolean(v.isDefault),
        sortOrder: index + 1,
      }));
    if (rows.length) await db.insert(menuVariants).values(rows);
  }
  if (addonIds) {
    await db.delete(menuItemAddons).where(eq(menuItemAddons.menuItemId, menuItemId));
    if (addonIds.length) {
      await db
        .insert(menuItemAddons)
        .values(addonIds.filter((n) => Number.isFinite(n)).map((addonId) => ({ menuItemId, addonId })))
        .onConflictDoNothing();
    }
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const def = getResource(resource);
  if (!def) return jsonError("Unknown resource.", 404);
  return route(async () => {
    const admin = await requireAdmin(def.managePermission);
    const body = (await request.json()) as { ids?: number[]; values?: Record<string, unknown> };
    if (!Array.isArray(body.ids) || !body.values) bad("Provide ids[] and values.");
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body.values)) {
      const coerced = coerce(def, key, value);
      if (coerced !== undefined) patch[key] = coerced;
    }
    if (!Object.keys(patch).length) bad("Nothing to update.");
    for (const id of body.ids) {
      await db
        .update(def.table)
        .set(patch as never)
        .where(eq(tableColumns(def).id as never, id));
    }
    await writeAudit({
      adminId: admin.id,
      actorName: admin.name,
      action: `${def.key}.bulk_update`,
      entity: def.key,
      summary: `Bulk updated ${body.ids.length} ${def.label.toLowerCase()}`,
      meta: patch,
    });
    return jsonOk({ updated: body.ids.length });
  }, `admin.resource.${resource}.bulk`);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const def = getResource(resource);
  if (!def) return jsonError("Unknown resource.", 404);
  if (def.deletable === false) return jsonError("This resource cannot be deleted.", 400);
  return route(async () => {
    const admin = await requireAdmin(def.managePermission);
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) bad("id is required.");
    if (def.softDelete) {
      const softPatch =
        def.key === "menu-items"
          ? { deletedAt: new Date(), isAvailable: false }
          : { deletedAt: new Date(), status: "blocked" };
      await db
        .update(def.table)
        .set(softPatch as never)
        .where(eq(tableColumns(def).id as never, id));
    } else {
      await db.delete(def.table).where(eq(tableColumns(def).id as never, id));
    }
    await writeAudit({
      adminId: admin.id,
      actorName: admin.name,
      action: `${def.key}.deleted`,
      entity: def.key,
      entityId: id,
      summary: `Deleted ${def.singular.toLowerCase()} #${id}`,
    });
    return jsonOk({ deleted: true });
  }, `admin.resource.${resource}.delete`);
}

export async function PUT(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const def = getResource(resource);
  if (!def) return jsonError("Unknown resource.", 404);
  return route(async () => {
    const admin = await requireAdmin(def.managePermission);
    const body = (await request.json()) as Record<string, unknown>;
    const id = Number(body.id);
    if (!id) bad("id is required.");
    const patch: Record<string, unknown> = {};
    for (const field of def.fields) {
      if (field.readOnly) continue;
      if (field.type === "password") continue;
      if (body[field.key] === undefined) continue;
      const coerced = coerce(def, field.key, body[field.key]);
      if (coerced !== undefined) patch[field.key] = coerced;
    }
    if (def.key === "coupons" && patch.code) patch.code = String(patch.code).toUpperCase();
    if (def.key === "admins" && typeof body.password === "string" && body.password.length >= 8) {
      const { hashPassword } = await import("@/lib/auth");
      patch.passwordHash = await hashPassword(body.password);
    }
    if (Object.keys(patch).length) {
      await db
        .update(def.table)
        .set(patch as never)
        .where(eq(tableColumns(def).id as never, id));
    }
    if (def.key === "menu-items") {
      await syncMenuNested(id, body);
    }
    await writeAudit({
      adminId: admin.id,
      actorName: admin.name,
      action: `${def.key}.updated`,
      entity: def.key,
      entityId: id,
      summary: `Updated ${def.singular.toLowerCase()} #${id}`,
      meta: patch,
    });
    return jsonOk({ updated: true, id });
  }, `admin.resource.${resource}.update`);
}


