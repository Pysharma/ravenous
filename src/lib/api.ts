import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, { status: 200, ...init });
}

export function jsonError(message: string, status = 400, code?: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, code, ...(extra ?? {}) }, { status });
}

const FRIENDLY = "Something went wrong. Please try again.";

export async function route<T>(handler: () => Promise<T>, context: string): Promise<NextResponse> {
  try {
    const result = await handler();
    if (result instanceof NextResponse) return result;
    return jsonOk(result);
  } catch (error) {
    const requestId = Math.random().toString(36).slice(2, 10);
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        level: "error",
        context,
        requestId,
        message,
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 4).join(" | ") : undefined,
        timestamp: new Date().toISOString(),
      }),
    );
    if (message.startsWith("BAD_REQUEST:")) {
      return jsonError(message.replace("BAD_REQUEST:", "").trim(), 400);
    }
    if (message.startsWith("NOT_FOUND:")) {
      return jsonError(message.replace("NOT_FOUND:", "").trim(), 404);
    }
    if (message.startsWith("FORBIDDEN:")) {
      return jsonError(message.replace("FORBIDDEN:", "").trim(), 403);
    }
    if (message.startsWith("UNAUTHORIZED:")) {
      return jsonError(message.replace("UNAUTHORIZED:", "").trim(), 401);
    }
    return jsonError(FRIENDLY, 500, "server_error", { requestId });
  }
}

export function bad(message: string): never {
  throw new Error(`BAD_REQUEST: ${message}`);
}

export function notFound(message: string): never {
  throw new Error(`NOT_FOUND: ${message}`);
}

export function forbid(message = "You do not have permission to perform this action."): never {
  throw new Error(`FORBIDDEN: ${message}`);
}

export function unauth(message = "Please sign in to continue."): never {
  throw new Error(`UNAUTHORIZED: ${message}`);
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryInMs: bucket.resetAt - now };
  }
  return { ok: true, remaining: limit - bucket.count };
}

export function assertRateLimit(key: string, limit: number, windowMs: number, message: string) {
  const result = rateLimit(key, limit, windowMs);
  if (!result.ok) bad(message);
}

export function clientIp(request: Request): string {
  const header = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
  return header?.split(",")[0]?.trim() || "127.0.0.1";
}

export async function writeAudit(input: {
  adminId?: number | null;
  actorType?: string;
  actorName?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | number | null;
  summary?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await db.insert(auditLogs).values({
      adminId: input.adminId ?? null,
      actorType: input.actorType ?? "admin",
      actorName: input.actorName ?? null,
      action: input.action,
      entity: input.entity ?? null,
      entityId: input.entityId === null || input.entityId === undefined ? null : String(input.entityId),
      summary: input.summary ?? null,
      meta: input.meta ?? null,
      ip: input.ip ?? null,
    });
  } catch (error) {
    console.error("audit log failed", error);
  }
}

export const FRIENDLY_ERROR = FRIENDLY;
