import { notFound } from "next/navigation";
import { ResourceManager } from "@/components/admin/AdminPanels";
import { RESOURCES } from "@/lib/adminResources";

export const dynamic = "force-dynamic";

const ALIASES: Record<string, string> = {
  gallery: "media",
  delivery: "delivery-zones",
  offers: "coupons",
  payments: "refunds",
};

export default async function AdminResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource: requested } = await params;
  const resource = ALIASES[requested] ?? requested;
  const def = RESOURCES.find((item) => item.key === resource);
  if (!def) notFound();

  if (requested === "gallery") {
    return (
      <ResourceManager
        resource="media"
        title="Gallery images"
        subtitle="Upload food, interior, exterior, drinks, kitchen and event photos. Set the website section (Homepage Hero, Featured Food, About, Gallery) so the image appears in the right place."
      />
    );
  }

  if (resource === "admins") {
    return (
      <div>
        <ResourceManager
          resource="admins"
          title="Admin users"
          subtitle="Create managers, kitchen staff, delivery partners and content managers. Assign a role and permissions, reset passwords and disable accounts. Passwords are hashed and never displayed."
        />
        <div className="card mt-5 p-5 text-sm text-ink/65">
          <h2 className="font-display text-xl">Roles available</h2>
          <p className="mt-2">
            Super Admin, Manager, Staff, Delivery Staff and Content Manager. Permission keys can be edited per role under Roles &amp;
            permissions. Credentials stay private: <span className="font-semibold">no password is ever shown or stored in plain text.</span>
          </p>
        </div>
      </div>
    );
  }

  if (resource === "roles") {
    return (
      <ResourceManager
        resource="roles"
        title="Roles & permissions"
        subtitle="One permission key per line — for example orders.view, orders.manage, orders.cancel, menu.edit, settings.manage, admins.manage. Permissions are enforced server-side on every API call."
      />
    );
  }

  if (resource === "tables") {
    return (
      <div>
        <ResourceManager
          resource="tables"
          title="Tables & QR ordering"
          subtitle="Set table numbers, seating capacity, floor/section and status. Each table has a unique QR token that opens /table/{token} for dine-in ordering."
        />
        <div className="card mt-5 p-5 text-sm">
          <h2 className="font-display text-xl">Table QR codes</h2>
          <p className="mt-2 text-ink/65">
            QR images are generated on demand from the configured table token — open <code>/api/admin/qr?code=RV-T01</code> to download one for
            printing, or use the Print QR button inside the create/edit form flow.
          </p>
        </div>
      </div>
    );
  }

  if (resource === "customers") {
    return (
      <ResourceManager
        resource="customers"
        title="Customers"
        subtitle="Search by name, phone or email. View status and last login; spend and order history are aggregated in Reports and on each order."
      />
    );
  }

  return <ResourceManager resource={def.key} title={def.label} subtitle={`Manage ${def.label.toLowerCase()} — every change is audited and reflected on the website.`} />;
}
