import { Suspense } from "react";
import { AuthPanel } from "@/components/site/AuthPanel";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-sm">Loading…</div>}>
      <AuthPanel mode="register" />
    </Suspense>
  );
}
