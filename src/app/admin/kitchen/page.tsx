import { KitchenBoard } from "@/components/admin/AdminPanels";

export const dynamic = "force-dynamic";

export default function AdminKitchenPage() {
  return (
    <div>
      <h1 className="font-display text-2xl">Kitchen display system</h1>
      <p className="text-sm text-ink/60">
        Touch-friendly kitchen board with live order tickets, preparation timers and delay warnings. Advance a ticket to move the order through
        the kitchen.
      </p>
      <div className="mt-5">
        <KitchenBoard />
      </div>
    </div>
  );
}
