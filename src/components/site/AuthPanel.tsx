"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/site/CartProvider";

type Mode = "login" | "register" | "forgot" | "reset";

export function AuthPanel({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser, toast } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(params.get("token") ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setResetLink(null);
    try {
      const action = mode;
      const payload =
        mode === "login"
          ? { action, email, password }
          : mode === "register"
            ? { action, name, email, phone, password }
            : mode === "forgot"
              ? { action, email }
              : { action, token, password };
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; message?: string; resetLink?: string };
      if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      if (mode === "forgot") {
        setMessage(data.message ?? "If an account exists for that email, a reset link has been sent.");
        if (data.resetLink) setResetLink(data.resetLink);
        return;
      }
      if (mode === "reset") {
        toast("Password updated. You are signed in.", "success");
      } else {
        toast(mode === "login" ? "Welcome back!" : "Welcome to Ravenous!", "success");
      }
      await refreshUser();
      router.push("/account");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Mode, { heading: string; sub: string; cta: string }> = {
    login: { heading: "Welcome back", sub: "Sign in to track orders, reorder favourites and manage reservations.", cta: "Sign in" },
    register: { heading: "Create your account", sub: "Order faster, save addresses and collect favourites.", cta: "Create account" },
    forgot: { heading: "Reset your password", sub: "We'll email you a secure reset link that expires in 60 minutes.", cta: "Send reset link" },
    reset: { heading: "Choose a new password", sub: "Use at least 8 characters.", cta: "Update password" },
  };

  return (
    <div className="container-page py-14">
      <div className="card mx-auto max-w-md p-6 sm:p-8">
        <h1 className="font-display text-3xl">{titles[mode].heading}</h1>
        <p className="mt-2 text-sm text-ink/60">{titles[mode].sub}</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {mode === "register" ? (
            <>
              <div>
                <label className="label" htmlFor="auth-name">
                  Full name
                </label>
                <input id="auth-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
              </div>
              <div>
                <label className="label" htmlFor="auth-phone">
                  Phone
                </label>
                <input id="auth-phone" className="input" value={phone} onChange={(event) => setPhone(event.target.value)} required inputMode="tel" />
              </div>
            </>
          ) : null}
          {mode !== "reset" ? (
            <div>
              <label className="label" htmlFor="auth-email">
                Email
              </label>
              <input id="auth-email" type="email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="auth-token">
                Reset token
              </label>
              <input id="auth-token" className="input" value={token} onChange={(event) => setToken(event.target.value)} required />
            </div>
          )}
          {mode !== "forgot" ? (
            <div>
              <label className="label" htmlFor="auth-password">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={mode === "login" ? 1 : 8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
          ) : null}

          {error ? <p className="rounded-xl bg-[#fdecea] p-3 text-sm text-[#a12622]">{error}</p> : null}
          {message ? <p className="rounded-xl bg-[#e8f5e9] p-3 text-sm text-[#23663a]">{message}</p> : null}
          {resetLink ? (
            <Link href={resetLink} className="block rounded-xl bg-cream-dark p-3 text-sm underline">
              Email delivery is not configured in this environment — open the reset link directly.
            </Link>
          ) : null}

          <button type="submit" className="btn btn-primary w-full py-3 text-base" disabled={loading}>
            {loading ? "Please wait…" : titles[mode].cta}
          </button>
        </form>

        <div className="mt-5 space-y-2 text-sm text-ink/65">
          {mode === "login" ? (
            <>
              <p>
                New to Ravenous?{" "}
                <Link href="/register" className="font-semibold underline">
                  Create an account
                </Link>
              </p>
              <p>
                <Link href="/forgot-password" className="font-semibold underline">
                  Forgot password?
                </Link>
              </p>
            </>
          ) : null}
          {mode === "register" ? (
            <p>
              Already have an account?{" "}
              <Link href="/login" className="font-semibold underline">
                Sign in
              </Link>
            </p>
          ) : null}
          {mode === "forgot" || mode === "reset" ? (
            <p>
              <Link href="/login" className="font-semibold underline">
                Back to sign in
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
