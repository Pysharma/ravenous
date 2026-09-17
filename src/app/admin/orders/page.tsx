import { OrdersBoard } from "@/components/admin/AdminPanels";

export const dynamic = "force-dynamic";

export default function AdminOrdersPage() {
  return (
    <div>
      <h1 className="font-display text-2xl">Orders</h1>
      <p className="text-sm text-ink/60">
        Live order queue with accept, reject, kitchen progress, driver assignment and payment actions. Filters cover today, order type and recent
        activity.
      </p>
      <div className="mt-5">
        <OrdersBoard />
      </div>
    </div>
  );
}
