import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { restaurantTables } from "@/db/schema";
import { jsonError, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const base = url.searchParams.get("base") ?? url.origin;
  if (!code) return jsonError("Table code is required.", 400);
  try {
    await requireAdmin("tables.manage");
  } catch {
    return jsonError("Admin sign-in required.", 401);
  }
  const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.code, code)).limit(1);
  if (!table) return jsonError("Table not found.", 404);
  const svg = await QRCode.toString(`${base}/table/${table.code}`, {
    type: "svg",
    width: 320,
    margin: 1,
    color: { dark: "#20130c", light: "#ffffff" },
  });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" } });
}

export async function POST(request: Request) {
  return route(async () => {
    await requireAdmin("tables.manage");
    const body = (await request.json().catch(() => ({}))) as { codes?: string[]; base?: string };
    const codes = body.codes ?? [];
    const base = body.base ?? new URL(request.url).origin;
    const result: Record<string, string> = {};
    for (const code of codes) {
      result[code] = await QRCode.toDataURL(`${base}/table/${code}`, { width: 320, margin: 1 });
    }
    return { qr: result };
  }, "admin.qr");
}
