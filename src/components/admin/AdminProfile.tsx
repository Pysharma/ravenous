"use client";

import { useEffect, useState } from "react";
import { useAdminSession } from "@/components/admin/AdminPanels";
import { formatDateTime } from "@/lib/format";

export function AdminProfile() {
  const { admin } = useAdminSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(null);
  }, [admin]);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change-password", currentPassword, newPassword }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not change the password.");
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not change the password.");
    }
  };

  if (!admin) return <div className="skeleton h-40 w-full" />;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card p-5 text-sm">
        <h1 className="font-display text-2xl">My profile</h1>
        <dl className="mt-4 space-y-2">
          <div><dt className="label">Name</dt><dd>{admin.name}</dd></div>
          <div><dt className="label">Email</dt><dd>{admin.email}</dd></div>
          <div><dt className="label">Role</dt><dd>{admin.roleName}{admin.isSuperAdmin ? " (super admin)" : ""}</dd></div>
          <div>
            <dt className="label">Permissions</dt>
            <dd className="text-xs">
              {admin.isSuperAdmin ? "All permissions" : admin.permissions.length ? admin.permissions.join(", ") : "No permissions assigned — ask a super admin."}
            </dd>
          </div>
          <div><dt className="label">Session</dt><dd>Signed in · {formatDateTime(new Date())}</dd></div>
        </dl>
      </div>
      <form className="card p-5" onSubmit={changePassword}>
        <h2 className="font-display text-2xl">Change password</h2>
        <div className="mt-4 grid gap-3">
          <div>
            <label className="label" htmlFor="current">
              Current password
            </label>
            <input id="current" type="password" className="input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="next">
              New password
            </label>
            <input id="next" type="password" className="input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} />
          </div>
        </div>
        {message ? <p className="mt-4 rounded-xl bg-cream-dark p-3 text-sm">{message}</p> : null}
        <button type="submit" className="btn btn-primary mt-4">
          Update password
        </button>
      </form>
    </div>
  );
}
