import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { media } from "@/db/schema";
import { bad, jsonOk, route, writeAudit } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 6 * 1024 * 1024;

function detectMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  const brand = String.fromCharCode(...bytes.slice(4, 12));
  if (brand.includes("ftypavif") || brand.includes("ftypmif1")) return "image/avif";
  return null;
}

export async function POST(request: Request) {
  return route(async () => {
    /// Anyone who edits a section that contains images may upload:
    /// content (homepage/media), settings (logo/hero/about), or menu (dishes/categories).
    const admin = await requireAdmin(["content.manage", "settings.manage", "menu.edit"]);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) bad("Please choose an image to upload.");
    if (file.size > MAX_BYTES) bad("Images must be 6 MB or smaller.");
    const buffer = new Uint8Array(await file.arrayBuffer());
    const detected = detectMime(buffer);
    if (!detected || !ALLOWED.includes(detected)) {
      bad("Only JPG, PNG, WebP or AVIF images are allowed.");
    }
    const ext = detected.split("/")[1].replace("jpeg", "jpg");
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), buffer);
    const url = `/uploads/${fileName}`;
    const [created] = await db
      .insert(media)
      .values({
        url,
        title: String(form.get("title") ?? file.name),
        altText: String(form.get("altText") ?? ""),
        category: String(form.get("category") ?? "food"),
        section: String(form.get("section") ?? "") || null,
        mimeType: detected,
        fileSize: file.size,
        sortOrder: 0,
        isActive: true,
      })
      .returning();
    await writeAudit({
      adminId: admin.id,
      actorName: admin.name,
      action: "media.uploaded",
      entity: "media",
      entityId: created.id,
      summary: `Uploaded image ${file.name}`,
    });
    return jsonOk({ media: created, warning: null });
  }, "admin.upload");
}
