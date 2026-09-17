import { Suspense } from "react";
import { AuthPanel } from "@/components/site/AuthPanel";

export const metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-sm">Loading…</div>}>
      <AuthPanel mode="login" />
    </Suspense>
  );
}
