"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/site/CartProvider";

type ReservationConfig = {
  enabled: boolean;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  minGuests: number;
  maxGuests: number;
  maxPerSlot: number;
  autoConfirm: boolean;
  maxDaysAhead: number;
};

export default function ReservationsPage() {
  const { brand, user } = useCart();
  const [config, setConfig] = useState<ReservationConfig | null>(null);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    time: "20:00",
    guests: 2,
    specialRequest: "",
  });
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const data = (await response.json()) as { reservation: ReservationConfig };
      setConfig(data.reservation);
    })();
  }, []);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({ ...prev, name: prev.name || user.name, phone: prev.phone || user.phone || "", email: prev.email || user.email }));
    }
  }, [user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, guests: Number(form.guests) }),
      });
      const data = (await response.json()) as { error?: string; reservation?: { code: string; status: string } };
      if (!response.ok) throw new Error(data.error ?? "We could not take that reservation.");
      setStatus({
        tone: "success",
        message: `Reservation ${data.reservation?.code} ${data.reservation?.status === "confirmed" ? "confirmed" : "requested"}. We'll confirm shortly.`,
      });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "We could not take that reservation." });
    } finally {
      setSubmitting(false);
    }
  };

  const slots = Array.from({ length: 12 }).map((_, index) => {
    const start = config?.openTime ?? "12:00";
    const [hour, minute] = start.split(":").map(Number);
    const total = hour * 60 + minute + index * (config?.slotMinutes ?? 60);
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  });

  return (
    <div>
      <section className="bg-ink py-12 text-cream">
        <div className="container-page">
          <p className="label !text-gold">Reservations</p>
          <h1 className="font-display text-4xl">Book a Table at {brand.shortName}</h1>
          <p className="mt-3 max-w-2xl text-sm text-cream/75">
            {brand.address} · {brand.phone}
          </p>
        </div>
      </section>

      <section className="container-page grid gap-8 py-12 lg:grid-cols-[1.2fr_1fr]">
        <form className="card p-6" onSubmit={submit}>
          <h2 className="font-display text-2xl">Reservation details</h2>
          {config && !config.enabled ? (
            <p className="mt-3 rounded-2xl bg-[#fff5e1] p-3 text-sm text-[#93610c]">
              Online reservations are currently closed. Please call {brand.phone} and our team will help you.
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="res-date">
                Date
              </label>
              <input
                id="res-date"
                type="date"
                className="input"
                required
                value={form.date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="res-time">
                Time
              </label>
              <select id="res-time" className="select" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })}>
                {slots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="res-guests">
                Guests
              </label>
              <input
                id="res-guests"
                type="number"
                min={config?.minGuests ?? 1}
                max={config?.maxGuests ?? 20}
                className="input"
                required
                value={form.guests}
                onChange={(event) => setForm({ ...form, guests: Number(event.target.value) })}
              />
            </div>
            <div>
              <label className="label" htmlFor="res-name">
                Name
              </label>
              <input id="res-name" className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="res-phone">
                Phone
              </label>
              <input id="res-phone" className="input" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="res-email">
                Email
              </label>
              <input id="res-email" type="email" className="input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="res-request">
                Special request
              </label>
              <textarea
                id="res-request"
                className="textarea"
                rows={3}
                maxLength={300}
                placeholder="Birthday celebration, Jain food, corner table..."
                value={form.specialRequest}
                onChange={(event) => setForm({ ...form, specialRequest: event.target.value })}
              />
            </div>
          </div>
          {status ? (
            <p className={`mt-4 rounded-2xl p-3 text-sm ${status.tone === "success" ? "bg-[#e8f5e9] text-[#23663a]" : "bg-[#fdecea] text-[#a12622]"}`}>
              {status.message}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary mt-5 py-3 text-base" disabled={submitting}>
            {submitting ? "Sending request…" : "Request reservation"}
          </button>
          <p className="mt-3 text-xs text-ink/50">
            {config
              ? `Reservations are accepted for ${config.minGuests}–${config.maxGuests} guests, ${config.openTime}–${config.closeTime}. Table availability is limited to ${config.maxPerSlot} bookings per slot.`
              : "Loading reservation settings…"}
          </p>
        </form>

        <aside className="space-y-4">
          <div className="card p-5 text-sm">
            <h2 className="font-display text-xl">Good to know</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-ink/70">
              <li>Reservations are subject to restaurant approval where auto-confirm is disabled.</li>
              <li>Please arrive within 15 minutes of your slot.</li>
              <li>You can cancel a reservation from your account at any time.</li>
              <li>For groups larger than the online limit, please call the restaurant.</li>
            </ul>
          </div>
          <div className="card p-5 text-sm">
            <h2 className="font-display text-xl">Prefer to order instead?</h2>
            <p className="mt-2 text-ink/70">Browse the menu for delivery, pickup or dine-in ordering with table QR support.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/menu" className="btn btn-primary">
                View Menu
              </Link>
              {user ? (
                <Link href="/account/reservations" className="btn btn-outline">
                  My reservations
                </Link>
              ) : (
                <Link href="/login" className="btn btn-outline">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
