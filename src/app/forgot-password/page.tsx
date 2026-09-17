import { Suspense } from "react";
import { AuthPanel } from "@/components/site/AuthPanel";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-sm">Loading…</div>}>
      <AuthPanel mode="forgot" />
    </Suspense>
  );
}
