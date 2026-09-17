import { ResourceManager } from "@/components/admin/AdminPanels";

export const dynamic = "force-dynamic";

export default function AdminMenuPage() {
  return (
    <ResourceManager
      resource="menu-items"
      title="Menu & dishes"
      subtitle="Add, edit, duplicate, disable and reprice dishes. Variants are managed as JSON and add-ons can be linked by ID. Availability changes take effect on the website immediately."
    />
  );
}
