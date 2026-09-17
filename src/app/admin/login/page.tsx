import { AdminLogin } from "@/components/admin/AdminPanels";

export const metadata = { title: "Admin sign-in" };

export default function AdminLoginPage() {
  return (
    <div className="container-page py-16">
      <AdminLogin />
    </div>
  );
}
