import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { legalPages } from "@/db/schema";
import { getSettings, fullAddress } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page] = await db.select().from(legalPages).where(eq(legalPages.slug, slug)).limit(1);
  return { title: page?.title ?? "Policy" };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page] = await db.select().from(legalPages).where(eq(legalPages.slug, slug)).limit(1);
  if (!page || !page.isPublished) notFound();
  const settings = await getSettings();

  return (
    <div className="container-page py-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_260px]">
        <article className="card p-6 sm:p-8">
          <p className="label">Policies</p>
          <h1 className="font-display text-3xl sm:text-4xl">{page.title}</h1>
          <p className="mt-2 text-xs text-ink/50">Last updated {formatDateTime(page.updatedAt)}</p>
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-ink/75">
            {page.content.split("\n").filter(Boolean).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <p className="mt-6 text-xs text-ink/50">
            Questions about this policy? Contact {settings.name} at {settings.phone} · {fullAddress(settings)}
          </p>
        </article>
        <aside className="space-y-2 text-sm">
          <p className="label">All policies</p>
          {[
            ["privacy-policy", "Privacy Policy"],
            ["terms-conditions", "Terms & Conditions"],
            ["refund-policy", "Refund Policy"],
            ["cancellation-policy", "Cancellation Policy"],
            ["delivery-policy", "Delivery Policy"],
            ["reservation-policy", "Reservation Policy"],
          ].map(([href, label]) => (
            <Link key={href} href={`/policies/${href}`} className="block rounded-xl px-3 py-2 hover:bg-cream-dark">
              {label}
            </Link>
          ))}
          <Link href="/faq" className="block rounded-xl px-3 py-2 hover:bg-cream-dark">
            FAQ
          </Link>
          <Link href="/delivery-info" className="block rounded-xl px-3 py-2 hover:bg-cream-dark">
            Delivery information
          </Link>
        </aside>
      </div>
    </div>
  );
}
