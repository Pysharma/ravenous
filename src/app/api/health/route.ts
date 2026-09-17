import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = { app: "ok" };
  try {
    await db.execute(sql`select 1`);
    checks.database = "ok";
  } catch {
    checks.database = "unavailable";
  }
  if (checks.database === "ok") {
    try {
      const result = await ensureSeeded();
      checks.seed = result.seeded ? "seeded" : result.reason ?? "ready";
    } catch {
      checks.seed = "skipped";
    }
  }
  const healthy = checks.database === "ok";
  return Response.json(
    { status: healthy ? "ok" : "degraded", service: "ravenous-restaurant-platform", checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
