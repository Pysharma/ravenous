"use client";

import { useState } from "react";
import { useCart } from "@/components/site/CartProvider";

export function ProfileForm({
  initialName,
  initialPhone,
  email,
  emailVerified,
  createdAt,
}: {
  initialName: string;
  initialPhone: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date | string;
}) {
  const { toast, refreshUser } = useCart();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-profile", name, phone }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save your profile.");
      await refreshUser();
      toast("Profile updated", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save your profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change-password", currentPassword, newPassword }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not change your password.");
      setCurrentPassword("");
      setNewPassword("");
      toast("Password changed", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not change your password.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <form className="card p-5" onSubmit={saveProfile}>
        <h2 className="font-display text-xl">My profile</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="profile-name">
              Name
            </label>
            <input id="profile-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="profile-phone">
              Phone
            </label>
            <input id="profile-phone" className="input" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Email</label>
            <input className="input" value={email} readOnly />
            <p className="mt-1 text-xs text-ink/50">
              {emailVerified ? "Email verified" : "Email verification pending — contact the restaurant if you need help."} · Member since{" "}
              {new Date(createdAt).toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>
        <button type="submit" className="btn btn-primary mt-4" disabled={saving}>
          Save changes
        </button>
      </form>

      <form className="card p-5" onSubmit={changePassword}>
        <h2 className="font-display text-xl">Change password</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="current-password">
              Current password
            </label>
            <input id="current-password" type="password" className="input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="new-password">
              New password
            </label>
            <input id="new-password" type="password" className="input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} />
          </div>
        </div>
        <button type="submit" className="btn btn-dark mt-4" disabled={saving}>
          Update password
        </button>
      </form>
    </div>
  );
}
