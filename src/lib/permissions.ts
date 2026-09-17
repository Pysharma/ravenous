import type { AdminUser } from "@/db/schema";

export type PermissionGroup = {
  group: string;
  items: { key: string; label: string }[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: "Orders",
    items: [
      { key: "orders.view", label: "View orders" },
      { key: "orders.manage", label: "Accept / progress orders" },
      { key: "orders.cancel", label: "Cancel / reject orders" },
      { key: "orders.refund", label: "Process refunds" },
    ],
  },
  {
    group: "Kitchen",
    items: [{ key: "kitchen.view", label: "Kitchen display" }, { key: "kitchen.manage", label: "Move kitchen tickets" }],
  },
  {
    group: "Menu & inventory",
    items: [
      { key: "menu.view", label: "View menu" },
      { key: "menu.create", label: "Create dishes" },
      { key: "menu.edit", label: "Edit dishes / prices" },
      { key: "menu.delete", label: "Delete dishes" },
      { key: "inventory.manage", label: "Manage inventory" },
    ],
  },
  {
    group: "Customers & guests",
    items: [
      { key: "customers.view", label: "View customers" },
      { key: "reservations.manage", label: "Manage reservations" },
      { key: "tables.manage", label: "Manage tables & QR" },
      { key: "support.manage", label: "Manage support tickets" },
    ],
  },
  {
    group: "Delivery",
    items: [
      { key: "delivery.view", label: "View deliveries" },
      { key: "delivery.manage", label: "Assign drivers / update delivery" },
    ],
  },
  {
    group: "Payments",
    items: [
      { key: "payments.view", label: "View payments" },
      { key: "payments.manage", label: "Confirm / manage payments" },
    ],
  },
  {
    group: "Marketing & content",
    items: [
      { key: "offers.manage", label: "Offers & coupons" },
      { key: "content.manage", label: "Homepage, gallery, pages" },
      { key: "reviews.manage", label: "Moderate reviews" },
    ],
  },
  {
    group: "Administration",
    items: [
      { key: "reports.view", label: "Reports & analytics" },
      { key: "settings.manage", label: "Restaurant settings" },
      { key: "admins.manage", label: "Admin users & roles" },
      { key: "audit.view", label: "Audit logs" },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export const ROLE_PRESETS: { slug: string; name: string; description: string; permissions: string[] }[] = [
  {
    slug: "super-admin",
    name: "Super Admin",
    description: "Complete access to every module.",
    permissions: ALL_PERMISSIONS,
  },
  {
    slug: "manager",
    name: "Manager",
    description: "Runs day-to-day operations, menu, customers and reports.",
    permissions: [
      "orders.view",
      "orders.manage",
      "orders.cancel",
      "orders.refund",
      "kitchen.view",
      "kitchen.manage",
      "menu.view",
      "menu.create",
      "menu.edit",
      "inventory.manage",
      "customers.view",
      "reservations.manage",
      "tables.manage",
      "support.manage",
      "delivery.view",
      "delivery.manage",
      "payments.view",
      "payments.manage",
      "offers.manage",
      "reviews.manage",
      "reports.view",
    ],
  },
  {
    slug: "staff",
    name: "Staff",
    description: "Takes orders, runs the kitchen and handles guests.",
    permissions: [
      "orders.view",
      "orders.manage",
      "kitchen.view",
      "kitchen.manage",
      "menu.view",
      "customers.view",
      "reservations.manage",
      "support.manage",
    ],
  },
  {
    slug: "delivery-staff",
    name: "Delivery Staff",
    description: "Sees assigned deliveries only.",
    permissions: ["orders.view", "delivery.view", "delivery.manage"],
  },
  {
    slug: "content-manager",
    name: "Content Manager",
    description: "Homepage, gallery, offers and menu content.",
    permissions: ["menu.view", "menu.edit", "content.manage", "offers.manage", "reviews.manage"],
  },
];

export function hasPermission(
  admin: Pick<AdminUser, "isSuperAdmin"> & { permissions?: string[] } | null,
  permission: string,
): boolean {
  if (!admin) return false;
  if (admin.isSuperAdmin) return true;
  return (admin.permissions ?? []).includes(permission);
}

export function hasAnyPermission(
  admin: Pick<AdminUser, "isSuperAdmin"> & { permissions?: string[] } | null,
  permissions: string[],
): boolean {
  if (!admin) return false;
  if (admin.isSuperAdmin) return true;
  return permissions.some((p) => hasPermission(admin, p));
}
