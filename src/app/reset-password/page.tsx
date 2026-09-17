import { Suspense } from "react";
import { AuthPanel } from "@/components/site/AuthPanel";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-sm">Loading…</div>}>
      <AuthPanel mode="reset" />
    </Suspense>
  );
}
