import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { formatDateTime, formatINR } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/site/ProfileForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "My profile" };

export default async function AccountPage() {
  const user = await requireUser();
  const stats = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`coalesce(sum(case when status in ('delivered','completed','picked_up') then 1 else 0 end),0)::int`,
      cancelled: sql<number>`coalesce(sum(case when status in ('cancelled','rejected') then 1 else 0 end),0)::int`,
      spend: sql<number>`coalesce(sum(case when status not in ('cancelled','rejected') then total else 0 end),0)::int`,
      last: sql<string | null>`max(created_at)`,
    })
    .from(orders)
    .where(eq(orders.userId, user.id));

  const summary = stats[0] ?? { total: 0, completed: 0, cancelled: 0, spend: 0, last: null as string | null };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <ProfileForm
        initialName={user.name}
        initialPhone={user.phone ?? ""}
        email={user.email}
        emailVerified={user.emailVerified}
        createdAt={user.createdAt}
      />
      <div className="space-y-4">
        <div className="card p-5">
          <h2 className="font-display text-xl">Your Ravenous activity</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-ink/55">Total orders</dt>
              <dd className="font-display text-2xl">{summary.total}</dd>
            </div>
            <div>
              <dt className="text-ink/55">Completed</dt>
              <dd className="font-display text-2xl">{summary.completed}</dd>
            </div>
            <div>
              <dt className="text-ink/55">Cancelled</dt>
              <dd className="font-display text-2xl">{summary.cancelled}</dd>
            </div>
            <div>
              <dt className="text-ink/55">Total spent</dt>
              <dd className="font-display text-2xl">{formatINR(summary.spend)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-ink/50">
            Last order: {summary.last ? formatDateTime(summary.last) : "No orders yet"}
            {summary.total ? ` · Average order ${formatINR(Math.round(summary.spend / summary.total))}` : ""}
          </p>
        </div>
        <div className="card p-5 text-sm text-ink/70">
          <h2 className="font-display text-xl">Account security</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Passwords are stored as salted bcrypt hashes — never in plain text.</li>
            <li>Sessions use HTTP-only cookies signed with the AUTH_SECRET.</li>
            <li>You can only view your own orders, addresses and support tickets.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
