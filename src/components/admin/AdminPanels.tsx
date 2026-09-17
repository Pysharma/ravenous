"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime, formatINR, relativeTime } from "@/lib/format";
import { ImageField } from "@/components/admin/ImageField";

type Json = Record<string, unknown>;
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error((data as { error?: string }).error ?? "Request failed. Please try again.");
  return data;
}

/* ------------------------------------------------------------------ login --- */

export function AdminLogin() {
  const [email, setEmail] = useState("admin@ravenous.local");
  const [password, setPassword] = useState("Admin@12345");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      window.location.href = "/admin/dashboard";
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <form className="card p-6" onSubmit={submit}>
        <p className="label">Ravenous admin</p>
        <h1 className="font-display text-2xl">Staff sign-in</h1>
        <p className="mt-1 text-sm text-ink/60">Customer accounts cannot access this area.</p>
        <div className="mt-5 grid gap-3">
          <div>
            <label className="label" htmlFor="admin-email">
              Email
            </label>
            <input id="admin-email" type="email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="admin-password">
              Password
            </label>
            <input id="admin-password" type="password" className="input" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
        </div>
        {error ? <p className="mt-4 rounded-xl bg-[#fdecea] p-3 text-sm text-[#a12622]">{error}</p> : null}
        <button type="submit" className="btn btn-primary mt-5 w-full py-3" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-xs text-ink/50">
          Demo credentials are pre-filled. Change the admin password from Profile after your first sign-in.
        </p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------- order actions -- */

export function OrderActions({ orderId, order, onDone }: { orderId: number; order: Json; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("Restaurant busy");
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([]);
  const [driverId, setDriverId] = useState("");
  const status = str(order.status);
  const orderType = str(order.orderType);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api<{ drivers: { id: number; name: string }[] }>("/api/admin/options");
        setDrivers(data.drivers ?? []);
      } catch {
        setDrivers([]);
      }
    })();
  }, []);

  const run = async (body: Json, successMessage: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await api(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setMessage(successMessage);
      onDone?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const next: { status: string; label: string }[] = (() => {
    const flows: Record<string, { status: string; label: string }[]> = {
      delivery: [
        { status: "accepted", label: "Accept order" },
        { status: "preparing", label: "Start preparing" },
        { status: "ready", label: "Mark ready" },
        { status: "out_for_delivery", label: "Out for delivery" },
        { status: "delivered", label: "Mark delivered" },
        { status: "completed", label: "Complete" },
      ],
      pickup: [
        { status: "accepted", label: "Accept order" },
        { status: "preparing", label: "Start preparing" },
        { status: "ready_for_pickup", label: "Ready for pickup" },
        { status: "picked_up", label: "Picked up" },
        { status: "completed", label: "Complete" },
      ],
      dinein: [
        { status: "accepted", label: "Accept order" },
        { status: "preparing", label: "Start preparing" },
        { status: "ready", label: "Ready" },
        { status: "served", label: "Served" },
        { status: "bill_requested", label: "Bill requested" },
        { status: "completed", label: "Complete" },
      ],
    };
    return flows[orderType] ?? flows.delivery;
  })();

  return (
    <div className="card p-5">
      <h2 className="font-display text-xl">Actions</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {next.map((step) => (
          <button
            key={step.status}
            type="button"
            disabled={busy || status === step.status}
            className={`btn px-4 py-1.5 text-xs ${str(order.status) === step.status ? "btn-dark opacity-60" : "btn-primary"}`}
            onClick={() => void run({ action: "status", status: step.status }, `${step.label} done.`)}
          >
            {step.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor="cancel-reason">
            Cancellation / rejection reason
          </label>
          <select id="cancel-reason" className="select" value={reason} onChange={(event) => setReason(event.target.value)}>
            {["Restaurant busy", "Item unavailable", "Delivery unavailable", "Kitchen closed", "Technical problem", "Other", "Customer request"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-outline text-[#a12622]" disabled={busy} onClick={() => void run({ action: "status", status: "rejected", reason }, "Order rejected.")}>
          Reject order
        </button>
        <button type="button" className="btn btn-outline text-[#a12622]" disabled={busy} onClick={() => void run({ action: "status", status: "cancelled", reason }, "Order cancelled.")}>
          Cancel order
        </button>
      </div>

      {orderType === "delivery" ? (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="assign-driver">
              Assign delivery staff
            </label>
            <select id="assign-driver" className="select" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
              <option value="">Select driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-dark"
            disabled={busy || !driverId}
            onClick={() =>
              void run(
                { action: "assign-driver", driverId: Number(driverId), driverName: drivers.find((d) => String(d.id) === driverId)?.name },
                "Driver assigned and order marked out for delivery.",
              )
            }
          >
            Assign & dispatch
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void run({ action: "confirm-payment" }, "Payment confirmed.")}>
          Confirm payment received
        </button>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void run({ action: "collect-cod" }, "COD marked collected.")}>
          Mark COD collected
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy}
          onClick={() => void run({ action: "refund", amount: Number(order.total), reason: "Refund requested by staff" }, "Refund raised (status: pending until the payment partner confirms).")}
        >
          Raise refund
        </button>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void run({ action: "refund-complete" }, "Refund marked complete.")}>
          Mark refund complete
        </button>
      </div>

      <AdminNoteBox orderId={orderId} initial={str(order.adminNote)} onSaved={onDone} />
      {message ? <p className="mt-3 rounded-xl bg-cream-dark p-3 text-xs">{message}</p> : null}
    </div>
  );
}

function AdminNoteBox({ orderId, initial, onSaved }: { orderId: number; initial: string; onSaved?: () => void }) {
  const [note, setNote] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <div className="mt-4">
      <label className="label" htmlFor="admin-note">
        Private admin note
      </label>
      <textarea id="admin-note" className="textarea" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      <button
        type="button"
        className="btn btn-outline mt-2 text-xs"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await api(`/api/admin/orders/${orderId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "note", adminNote: note }),
            });
            onSaved?.();
          } finally {
            setSaving(false);
          }
        }}
      >
        Save note
      </button>
    </div>
  );
}

/* ------------------------------------------------------------- kitchen board -- */

type LiveOrder = {
  id: number;
  orderCode: string;
  status: string;
  statusLabel: string;
  orderType: string;
  total: number;
  customerName: string;
  tableCode: string | null;
  createdAt: string;
  paymentStatus: string;
};

export function KitchenBoard() {
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sound, setSound] = useState(false);
  const [loading, setLoading] = useState(true);
  const knownNew = useRef<Set<number>>(new Set());

  const load = useCallback(async (announce = false) => {
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { counts: Record<string, number>; recentOrders: LiveOrder[] };
      setCounts(data.counts ?? {});
      setOrders(data.recentOrders ?? []);
      if (announce) {
        const fresh = (data.recentOrders ?? []).filter((order) => order.status === "placed" && !knownNew.current.has(order.id));
        if (fresh.length && sound) {
          try {
            const context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const oscillator = context.createOscillator();
            oscillator.frequency.value = 880;
            oscillator.connect(context.destination);
            oscillator.start();
            setTimeout(() => oscillator.stop(), 160);
          } catch {
            // audio not available
          }
        }
        fresh.forEach((order) => knownNew.current.add(order.id));
      }
    } finally {
      setLoading(false);
    }
  }, [sound]);

  useEffect(() => {
    void load(false);
    const interval = setInterval(() => void load(true), 8000);
    return () => clearInterval(interval);
  }, [load]);

  const columns = [
    { key: "new", label: "New", statuses: ["placed", "payment_pending", "payment_confirmed"] },
    { key: "accepted", label: "Accepted", statuses: ["accepted"] },
    { key: "preparing", label: "Preparing", statuses: ["preparing"] },
    { key: "ready", label: "Ready", statuses: ["ready", "ready_for_pickup", "served"] },
    { key: "done", label: "Completed / dispatched", statuses: ["out_for_delivery", "delivered", "picked_up", "bill_requested", "completed"] },
  ];

  const advance = async (order: LiveOrder) => {
    const flow: Record<string, string> = {
      placed: "accepted",
      payment_pending: "accepted",
      payment_confirmed: "accepted",
      accepted: "preparing",
      preparing: order.orderType === "delivery" || order.orderType === "dinein" ? "ready" : "ready_for_pickup",
      ready: order.orderType === "delivery" ? "out_for_delivery" : order.orderType === "pickup" ? "picked_up" : "served",
      ready_for_pickup: "picked_up",
      served: "completed",
      out_for_delivery: "delivered",
      picked_up: "completed",
      delivered: "completed",
    };
    const target = flow[order.status];
    if (!target) return;
    await api(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", status: target }),
    }).catch(() => undefined);
    void load(false);
  };

  const elapsed = (createdAt: string) => Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);

  if (loading) return <div className="skeleton h-72 w-full" />;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink/60">
          Live kitchen queue · {counts.placed ?? 0} new · {counts.preparing ?? 0} preparing · {counts.ready ?? 0} ready
        </p>
        <label className="ml-auto flex items-center gap-2 text-xs">
          <input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} />
          New order sound alert
        </label>
        <button type="button" className="btn btn-outline px-3 py-1 text-xs" onClick={() => void load(false)}>
          Refresh
        </button>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        {columns.map((column) => {
          const columnOrders = orders.filter((order) => column.statuses.includes(order.status));
          return (
            <section key={column.key} className="rounded-3xl bg-cream-dark/70 p-3">
              <h2 className="flex items-center justify-between px-1 text-sm font-semibold uppercase tracking-wide">
                {column.label}
                <span className="badge badge-muted">{columnOrders.length}</span>
              </h2>
              <div className="mt-3 space-y-3">
                {columnOrders.map((order) => {
                  const minutes = elapsed(order.createdAt);
                  const late = minutes > 25 && ["placed", "accepted", "preparing"].includes(order.status);
                  return (
                    <article key={order.id} className={`card p-3 ${late ? "border-[#a12622]" : ""}`}>
                      <div className="flex items-center justify-between">
                        <Link href={`/admin/orders/${order.id}`} className="font-semibold underline">
                          {order.orderCode}
                        </Link>
                        <span className={`badge ${late ? "badge-nonveg" : "badge-muted"}`}>{late ? `Delayed · ${minutes}m` : `${minutes}m`}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink/60">
                        {order.orderType.toUpperCase()} {order.tableCode ? `· Table ${order.tableCode}` : ""} · {order.customerName}
                      </p>
                      <p className="text-xs text-ink/50">
                        {formatINR(order.total)} · {order.paymentStatus.replace(/_/g, " ")}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" className="btn btn-primary px-3 py-1 text-xs" onClick={() => void advance(order)}>
                          Advance
                        </button>
                        <Link href="/admin/orders" className="btn btn-outline px-3 py-1 text-xs">
                          Manage
                        </Link>
                      </div>
                    </article>
                  );
                })}
                {!columnOrders.length ? <p className="px-1 text-xs text-ink/45">No orders</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- orders board -- */

export function OrdersBoard() {
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [filter, setFilter] = useState("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/reports?preset=daily", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load orders.");
      const dashboard = await api<{ recentOrders: LiveOrder[] }>("/api/admin/dashboard");
      setOrders(dashboard.recentOrders ?? []);
      void response;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 12000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return orders;
    if (filter === "today") return orders.filter((order) => new Date(order.createdAt).toDateString() === new Date().toDateString());
    return orders.filter((order) => order.orderType === filter);
  }, [filter, orders]);

  const quick = async (order: LiveOrder, status: string) => {
    await api(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", status, reason: status === "rejected" ? "Restaurant busy" : undefined }),
    }).catch(() => undefined);
    void load();
  };

  if (loading) return <div className="skeleton h-72 w-full" />;
  if (error) return <p className="text-sm text-[#a12622]">{error}</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[
          { id: "today", label: "Today" },
          { id: "delivery", label: "Delivery" },
          { id: "pickup", label: "Pickup" },
          { id: "dinein", label: "Dine-in" },
          { id: "all", label: "All recent" },
        ].map((option) => (
          <button key={option.id} type="button" className={`badge px-3 py-1.5 text-xs ${filter === option.id ? "badge-ember" : "badge-muted"}`} onClick={() => setFilter(option.id)}>
            {option.label}
          </button>
        ))}
        <a className="badge badge-muted ml-auto px-3 py-1.5 text-xs" href="/api/admin/export?type=orders">
          Export orders CSV
        </a>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-cream-dark/70 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Type</th>
              <th className="p-3">Placed</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-t border-ink/8">
                <td className="p-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-semibold underline">
                    {order.orderCode}
                  </Link>
                </td>
                <td className="p-3">
                  {order.customerName}
                  {order.tableCode ? <span className="block text-xs text-ink/55">Table {order.tableCode}</span> : null}
                </td>
                <td className="p-3">{order.orderType}</td>
                <td className="p-3 text-xs text-ink/60">{relativeTime(order.createdAt)}</td>
                <td className="p-3">{formatINR(order.total)}</td>
                <td className="p-3 text-xs">{order.paymentStatus.replace(/_/g, " ")}</td>
                <td className="p-3">
                  <span className="badge badge-muted">{order.statusLabel}</span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {order.status === "placed" ? (
                      <>
                        <button type="button" className="btn btn-primary px-2 py-1 text-[11px]" onClick={() => void quick(order, "accepted")}>
                          Accept
                        </button>
                        <button type="button" className="btn btn-outline px-2 py-1 text-[11px] text-[#a12622]" onClick={() => void quick(order, "rejected")}>
                          Reject
                        </button>
                      </>
                    ) : null}
                    {order.status === "accepted" ? (
                      <button type="button" className="btn btn-primary px-2 py-1 text-[11px]" onClick={() => void quick(order, "preparing")}>
                        Preparing
                      </button>
                    ) : null}
                    {order.status === "preparing" ? (
                      <button type="button" className="btn btn-primary px-2 py-1 text-[11px]" onClick={() => void quick(order, order.orderType === "pickup" ? "ready_for_pickup" : "ready")}>
                        Ready
                      </button>
                    ) : null}
                    <Link href={`/admin/orders/${order.id}`} className="btn btn-outline px-2 py-1 text-[11px]">
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-sm text-ink/55">
                  No orders match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ resource manager -- */

type FieldDef = {
  key: string;
  label: string;
  type: string;
  options?: { value: string; label: string }[];
  optionsFrom?: string;
  required?: boolean;
  help?: string;
  inTable?: boolean;
  readOnly?: boolean;
  createOnly?: boolean;
};

export function ResourceManager({ resource, title, subtitle }: { resource: string; title: string; subtitle?: string }) {
  const [rows, setRows] = useState<Json[]>([]);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [options, setOptions] = useState<Record<string, { id: number; name: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Json | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ rows: Json[]; schema: FieldDef[] }>(`/api/admin/resource/${resource}?q=${encodeURIComponent(query)}`);
      setRows(data.rows ?? []);
      setFields(data.schema ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, [query, resource]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api<{
          categories: { id: number; name: string }[];
          tables: { id: number; name: string }[];
          roles: { id: number; name: string }[];
          menu: { id: number; name: string }[];
          drivers: { id: number; name: string }[];
        }>("/api/admin/options");
        setOptions({ categories: data.categories, tables: data.tables, roles: data.roles, menu: data.menu, drivers: data.drivers });
      } catch {
        setOptions({});
      }
    })();
  }, []);

  const tableFields = fields.filter((field) => field.inTable !== false);

  const save = async (values: Json, id?: number) => {
    try {
      if (id) {
        await api(`/api/admin/resource/${resource}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...values }),
        });
      } else {
        await api(`/api/admin/resource/${resource}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
      }
      setToast(id ? "Saved" : "Created");
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save.");
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this record? This cannot be undone.")) return;
    try {
      await api(`/api/admin/resource/${resource}?id=${id}`, { method: "DELETE" });
      setToast("Deleted");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete.");
    }
  };

  const bulkToggle = async (id: number, patch: Json) => {
    try {
      await api(`/api/admin/resource/${resource}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], values: patch }),
      });
      await load();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "Could not update.");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl">{title}</h1>
          {subtitle ? <p className="text-sm text-ink/60">{subtitle}</p> : null}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <input className="input w-56" placeholder="Search…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            + New
          </button>
          <a className="btn btn-outline" href={`/api/admin/export?type=${resource === "menu-items" ? "menu" : resource === "refunds" ? "refunds" : resource === "reservations" ? "reservations" : resource === "inventory" ? "inventory" : "orders"}`}>
            Export CSV
          </a>
        </div>
      </div>

      {toast ? <p className="mt-3 rounded-xl bg-[#e8f5e9] p-2 text-xs text-[#23663a]">{toast}</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-[#fdecea] p-2 text-xs text-[#a12622]">{error}</p> : null}

      {showForm ? (
        <RecordForm
          resource={resource}
          fields={fields}
          options={options}
          initial={editing ?? undefined}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={save}
        />
      ) : null}

      <div className="card mt-4 overflow-x-auto">
        {loading ? (
          <div className="p-6">
            <div className="skeleton h-40 w-full" />
          </div>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-cream-dark/70 text-left text-xs uppercase tracking-wide">
              <tr>
                {tableFields.slice(0, 8).map((field) => (
                  <th key={field.key} className="p-3">
                    {field.label}
                  </th>
                ))}
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)} className="border-t border-ink/8 align-top">
                  {tableFields.slice(0, 8).map((field) => (
                    <td key={field.key} className="p-3">
                      {renderCell(field, row[field.key])}
                    </td>
                  ))}
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="btn btn-outline px-2 py-1 text-[11px]"
                        onClick={() => {
                          setEditing(row);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </button>
                      {"isActive" in row ? (
                        <button type="button" className="btn btn-outline px-2 py-1 text-[11px]" onClick={() => void bulkToggle(Number(row.id), { isActive: !row.isActive })}>
                          {row.isActive ? "Disable" : "Enable"}
                        </button>
                      ) : null}
                      {"isAvailable" in row ? (
                        <button
                          type="button"
                          className="btn btn-outline px-2 py-1 text-[11px]"
                          onClick={() => void bulkToggle(Number(row.id), { isAvailable: !row.isAvailable })}
                        >
                          {row.isAvailable ? "Mark unavailable" : "Mark available"}
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-outline px-2 py-1 text-[11px] text-[#a12622]" onClick={() => void remove(Number(row.id))}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-ink/55">
                    Nothing here yet. Use “+ New” to add the first record.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function renderCell(field: FieldDef, value: unknown) {
  if (value === null || value === undefined || value === "") return <span className="text-ink/35">—</span>;
  if (field.type === "money") return formatINR(Number(value));
  if (field.type === "boolean") return value ? "Yes" : "No";
  if (field.type === "image" || field.type === "imageurl") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={String(value)} alt="" className="h-10 w-14 rounded-lg object-cover" />;
  }
  if (field.type === "datetime") return formatDateTime(String(value));
  if (field.type === "permissions") return <span className="text-xs">{Array.isArray(value) ? `${value.length} permissions` : String(value)}</span>;
  const text = String(value);
  if (text.startsWith("/uploads") || text.startsWith("/images")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={text} alt="" className="h-10 w-14 rounded-lg object-cover" />;
  }
  return <span className="line-clamp-2 max-w-[240px]">{text}</span>;
}

function RecordForm({
  resource,
  fields,
  options,
  initial,
  onCancel,
  onSubmit,
}: {
  resource: string;
  fields: FieldDef[];
  options: Record<string, { id: number; name: string }[]>;
  initial?: Json;
  onCancel: () => void;
  onSubmit: (values: Json, id?: number) => Promise<void>;
}) {
  const [values, setValues] = useState<Json>(() => {
    const base: Json = { ...(initial ?? {}) };
    for (const field of fields) {
      if (base[field.key] !== undefined) continue;
      if (field.type === "boolean") base[field.key] = false;
      else if (field.type === "money") base[field.key] = "";
      else base[field.key] = "";
    }
    return base;
  });
  const [variantJson, setVariantJson] = useState<string>(() => JSON.stringify((initial?.variants as unknown) ?? [], null, 2));
  const [addonIds, setAddonIds] = useState<string>(() => "");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="card mt-4 p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          const payload: Json = { ...values };
          if (resource === "menu-items") {
            try {
              payload.variants = JSON.parse(variantJson || "[]");
            } catch {
              payload.variants = [];
            }
            payload.addonIds = addonIds
              .split(",")
              .map((id) => Number(id.trim()))
              .filter((id) => Number.isFinite(id) && id > 0);
          }
          await onSubmit(payload, initial?.id ? Number(initial.id) : undefined);
        } finally {
          setSaving(false);
        }
      }}
    >
      <h2 className="font-display text-xl">{initial ? "Edit record" : "New record"}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {fields
          .filter((field) => !(field.createOnly && initial))
          .map((field) => (
            <div key={field.key} className={field.type === "textarea" || field.type === "permissions" ? "sm:col-span-2" : ""}>
              <label className="label" htmlFor={`field-${field.key}`}>
                {field.label}
                {field.required ? " *" : ""}
              </label>
              {field.type === "textarea" || field.type === "permissions" ? (
                field.type === "permissions" ? (
                  <textarea
                    id={`field-${field.key}`}
                    className="textarea"
                    rows={4}
                    value={Array.isArray(values[field.key]) ? (values[field.key] as string[]).join("\n") : str(values[field.key])}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean) })}
                    placeholder="One permission key per line, e.g. orders.view"
                  />
                ) : (
                  <textarea
                    id={`field-${field.key}`}
                    className="textarea"
                    rows={4}
                    value={str(values[field.key])}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  />
                )
              ) : field.type === "boolean" ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    id={`field-${field.key}`}
                    type="checkbox"
                    checked={Boolean(values[field.key])}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.checked })}
                  />
                  Enabled
                </label>
              ) : field.type === "image" ? (
                <ImageField
                  id={`field-${field.key}`}
                  value={str(values[field.key])}
                  onChange={(url) => setValues({ ...values, [field.key]: url })}
                  help={field.help ?? "Paste an image URL or upload a file (JPG, PNG, WebP or AVIF, max 6 MB)."}
                />
              ) : field.type === "select" ? (
                <select
                  id={`field-${field.key}`}
                  className="select"
                  value={str(values[field.key])}
                  onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                >
                  <option value="">—</option>
                  {(field.optionsFrom
                    ? (options[field.optionsFrom] ?? []).map((option) => ({ value: String(option.id), label: option.name }))
                    : field.options ?? []
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`field-${field.key}`}
                  className="input"
                  type={field.type === "number" || field.type === "money" ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : field.type === "password" ? "password" : "text"}
                  step={field.type === "money" ? "0.01" : undefined}
                  value={field.type === "money" && values[field.key] !== "" && values[field.key] !== undefined ? Number(values[field.key]) / 100 : str(values[field.key])}
                  onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  required={field.required}
                  readOnly={field.readOnly}
                />
              )}
              {field.help ? <p className="mt-1 text-xs text-ink/45">{field.help}</p> : null}
            </div>
          ))}
      </div>

      {resource === "menu-items" ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="variant-json">
              Variants (JSON: name, price in ₹, mrp, isDefault)
            </label>
            <textarea
              id="variant-json"
              className="textarea font-mono text-xs"
              rows={6}
              value={variantJson}
              onChange={(event) => setVariantJson(event.target.value)}
              placeholder='[{"name":"Half","price":180,"mrp":200},{"name":"Full","price":320,"mrp":360,"isDefault":true}]'
            />
          </div>
          <div>
            <label className="label" htmlFor="addon-ids">
              Linked add-on IDs (comma separated)
            </label>
            <input id="addon-ids" className="input" value={addonIds} onChange={(event) => setAddonIds(event.target.value)} placeholder="1,2,3" />
            <p className="mt-1 text-xs text-ink/45">Manage reusable add-ons under Add-ons, then link them to this dish.</p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- settings -- */

export function SettingsForm() {
  const [settings, setSettings] = useState<Json | null>(null);
  const [tab, setTab] = useState("business");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const data = await api<{ settings: Json }>("/api/admin/settings").catch(() => ({ settings: null }));
      setSettings((data.settings as Json) ?? null);
    })();
  }, []);

  if (!settings) return <div className="skeleton h-72 w-full" />;

  const set = (key: string, value: unknown) => setSettings((prev) => ({ ...(prev ?? {}), [key]: value }));
  const setGroup = (group: string, key: string, value: unknown) =>
    setSettings((prev) => ({ ...(prev ?? {}), [group]: { ...((prev?.[group] as Json) ?? {}), [key]: value } }));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setMessage("Settings saved. The customer website updates immediately.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const textField = (key: string, label: string, type = "text") => (
    <div key={key}>
      <label className="label" htmlFor={`s-${key}`}>
        {label}
      </label>
      <input
        id={`s-${key}`}
        className="input"
        type={type}
        value={str(settings[key])}
        onChange={(event) => set(key, event.target.value)}
      />
    </div>
  );

  const areaField = (key: string, label: string) => (
    <div key={key} className="sm:col-span-2">
      <label className="label" htmlFor={`s-${key}`}>
        {label}
      </label>
      <textarea id={`s-${key}`} className="textarea" rows={4} value={str(settings[key])} onChange={(event) => set(key, event.target.value)} />
    </div>
  );

  const groupField = (group: string, key: string, label: string, kind: "number" | "boolean" | "text" = "number", money = false) => {
    const groupValues = (settings[group] as Json) ?? {};
    const raw = groupValues[key];
    return (
      <div key={`${group}-${key}`}>
        <label className="label" htmlFor={`g-${group}-${key}`}>
          {label}
          {money ? " (₹)" : ""}
        </label>
        {kind === "boolean" ? (
          <label className="flex items-center gap-2 text-sm">
            <input id={`g-${group}-${key}`} type="checkbox" checked={Boolean(raw)} onChange={(event) => setGroup(group, key, event.target.checked)} />
            Enabled
          </label>
        ) : (
          <input
            id={`g-${group}-${key}`}
            className="input"
            type={kind === "number" ? "number" : "text"}
            step={money ? "0.01" : "1"}
            value={kind === "number" && money && raw !== undefined && raw !== null ? Number(raw) / 100 : str(raw)}
            onChange={(event) => setGroup(group, key, kind === "number" ? (money ? Math.round(Number(event.target.value || 0) * 100) : Number(event.target.value || 0)) : event.target.value)}
          />
        )}
      </div>
    );
  };

  const days = (settings.hours as { day: string; open: string; close: string; closed: boolean }[]) ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl">Restaurant settings</h1>
        <span className="badge badge-muted">Everything here updates the live website</span>
        <button type="button" className="btn btn-primary ml-auto" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save all settings"}
        </button>
      </div>
      {message ? <p className="mt-3 rounded-xl bg-cream-dark p-3 text-sm">{message}</p> : null}

      <nav className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {[
          ["business", "Business"],
          ["hours", "Hours & status"],
          ["delivery", "Delivery"],
          ["tax", "Tax"],
          ["payment", "Payments"],
          ["reservation", "Reservations"],
          ["ordering", "Ordering"],
        ].map(([key, label]) => (
          <button key={key} type="button" className={`badge px-3 py-1.5 text-xs ${tab === key ? "badge-ember" : "badge-muted"}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      <div className="card mt-4 p-5">
        {tab === "business" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {textField("name", "Restaurant name")}
            {textField("shortName", "Short name / brand")}
            {textField("tagline", "Tagline")}
            {textField("phone", "Phone")}
            {textField("altPhone", "Alternate phone")}
            {textField("whatsapp", "WhatsApp number")}
            {textField("email", "Email")}
            <ImageField
              label="Logo — URL or upload"
              id="s-logoUrl"
              value={str(settings.logoUrl)}
              onChange={(url) => set("logoUrl", url)}
              help="Shown in the site header. Paste a URL or upload JPG/PNG/WebP/AVIF."
            />
            <ImageField
              label="Favicon — URL or upload"
              id="s-faviconUrl"
              value={str(settings.faviconUrl)}
              onChange={(url) => set("faviconUrl", url)}
              help="Small square icon for the browser tab."
            />
            <ImageField
              label="Homepage hero image — URL or upload"
              id="s-heroImageUrl"
              value={str(settings.heroImageUrl)}
              onChange={(url) => set("heroImageUrl", url)}
              help="The 3D floating dish in the homepage hero."
            />
            <ImageField
              label="About image — URL or upload"
              id="s-aboutImageUrl"
              value={str(settings.aboutImageUrl)}
              onChange={(url) => set("aboutImageUrl", url)}
              help="Used on the About page and homepage story section."
            />
            {textField("galleryHeading", "Gallery heading")}
            {textField("priceRange", "Price range")}
            {textField("publicRating", "Public rating reference")}
            {textField("publicReviewCount", "Public review count reference", "number")}
            {textField("services", "Services (comma separated)")}
            {areaField("brandMessage", "Brand message")}
            {areaField("brandSubtext", "Brand supporting text")}
            {areaField("shortDescription", "Short description")}
            {areaField("aboutText", "About section")}
            {areaField("invoiceFooter", "Invoice footer")}
          </div>
        ) : null}

        {tab === "business" ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {textField("addressLine", "Address line")}
            {textField("city", "City")}
            {textField("state", "State")}
            {textField("pincode", "PIN code")}
            {textField("country", "Country")}
            {textField("mapsUrl", "Google Maps URL")}
            {textField("latitude", "Latitude")}
            {textField("longitude", "Longitude")}
            {textField("gstNumber", "GST number")}
            {textField("fssaiNumber", "FSSAI number")}
          </div>
        ) : null}

        {tab === "hours" ? (
          <div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="restaurant-status">
                  Restaurant status
                </label>
                <select id="restaurant-status" className="select" value={str(settings.status)} onChange={(event) => set("status", event.target.value)}>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="temporarily_closed">Temporarily closed</option>
                  <option value="busy">Busy (longer prep time)</option>
                  <option value="pickup_only">Accepting pickup only</option>
                  <option value="delivery_paused">Delivery paused</option>
                </select>
              </div>
              {textField("busyExtraMinutes", "Busy mode extra prep minutes", "number")}
              {textField("weeklyHoliday", "Weekly holiday (day name, or blank)")}
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="status-message">
                Customer-facing status banner
              </label>
              <textarea id="status-message" className="textarea" rows={2} value={str(settings.statusMessage)} onChange={(event) => set("statusMessage", event.target.value)} />
            </div>
            <h2 className="mt-6 font-display text-xl">Weekly opening hours</h2>
            <div className="mt-3 space-y-2">
              {days.map((day, index) => (
                <div key={day.day} className="grid items-end gap-2 sm:grid-cols-[120px_120px_120px_120px]">
                  <span className="text-sm font-medium">{day.day}</span>
                  <div>
                    <label className="label">Opens</label>
                    <input
                      className="input"
                      value={day.open}
                      onChange={(event) => {
                        const next = [...days];
                        next[index] = { ...day, open: event.target.value };
                        set("hours", next);
                      }}
                    />
                  </div>
                  <div>
                    <label className="label">Closes</label>
                    <input
                      className="input"
                      value={day.close}
                      onChange={(event) => {
                        const next = [...days];
                        next[index] = { ...day, close: event.target.value };
                        set("hours", next);
                      }}
                    />
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-xs">
                    <input
                      type="checkbox"
                      checked={day.closed}
                      onChange={(event) => {
                        const next = [...days];
                        next[index] = { ...day, closed: event.target.checked };
                        set("hours", next);
                      }}
                    />
                    Closed
                  </label>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "delivery" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {groupField("delivery", "enabled", "Delivery enabled", "boolean")}
            {groupField("delivery", "maxRadiusKm", "Maximum delivery radius (km)")}
            {groupField("delivery", "baseFee", "Base delivery fee", "number", true)}
            {groupField("delivery", "minOrderDelivery", "Minimum delivery order", "number", true)}
            {groupField("delivery", "minOrderPickup", "Minimum pickup order", "number", true)}
            {groupField("delivery", "freeDeliveryAbove", "Free delivery above", "number", true)}
            {groupField("delivery", "peakHourFee", "Peak-hour fee", "number", true)}
            {groupField("delivery", "peakStart", "Peak start (HH:MM)", "text")}
            {groupField("delivery", "peakEnd", "Peak end (HH:MM)", "text")}
            {groupField("delivery", "packagingFee", "Packaging fee", "number", true)}
            {groupField("delivery", "packagingPerItem", "Packaging charged per item", "boolean")}
            {groupField("delivery", "codEnabled", "Cash on delivery enabled", "boolean")}
            {groupField("delivery", "minOrderCod", "Minimum COD order", "number", true)}
            {groupField("delivery", "maxOrderCod", "Maximum COD order", "number", true)}
            {groupField("delivery", "contactlessEnabled", "Contactless delivery", "boolean")}
            {groupField("delivery", "driverAssignEnabled", "Delivery staff assignment", "boolean")}
            <p className="text-xs text-ink/50 sm:col-span-3">Distance slabs are managed in Delivery Zones. Delivery fees are always charged once per order.</p>
          </div>
        ) : null}

        {tab === "tax" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {groupField("tax", "gstEnabled", "GST enabled", "boolean")}
            {groupField("tax", "defaultRate", "Default GST %")}
            {groupField("tax", "packagingTaxRate", "Tax on packaging %")}
            {groupField("tax", "deliveryTaxRate", "Tax on delivery %")}
            {groupField("tax", "pricesIncludeTax", "Menu prices already include tax", "boolean")}
          </div>
        ) : null}

        {tab === "payment" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {groupField("payment", "onlineEnabled", "Online payments enabled", "boolean")}
            {groupField("payment", "upiEnabled", "UPI enabled", "boolean")}
            {groupField("payment", "cardEnabled", "Cards enabled", "boolean")}
            {groupField("payment", "netbankingEnabled", "Net banking enabled", "boolean")}
            {groupField("payment", "walletEnabled", "Wallets enabled", "boolean")}
            {groupField("payment", "codEnabled", "Cash on delivery enabled", "boolean")}
            {groupField("payment", "payAtRestaurant", "Pay at restaurant enabled", "boolean")}
            {groupField("payment", "upiId", "UPI ID (display only)", "text")}
            {groupField("payment", "razorpayMode", "Gateway mode (test/live display)", "text")}
            <p className="text-xs text-ink/50 sm:col-span-3">
              Razorpay keys are never stored in the database — configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as environment variables.
              Payment success is only recorded from a verified gateway signature or webhook, or by explicit staff confirmation.
            </p>
          </div>
        ) : null}

        {tab === "reservation" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {groupField("reservation", "enabled", "Reservations enabled", "boolean")}
            {groupField("reservation", "openTime", "Slots start (HH:MM)", "text")}
            {groupField("reservation", "closeTime", "Slots end (HH:MM)", "text")}
            {groupField("reservation", "slotMinutes", "Slot length (minutes)")}
            {groupField("reservation", "maxPerSlot", "Bookings per slot")}
            {groupField("reservation", "minGuests", "Minimum guests")}
            {groupField("reservation", "maxGuests", "Maximum guests online")}
            {groupField("reservation", "maxDaysAhead", "Advance booking days")}
            {groupField("reservation", "autoConfirm", "Auto-confirm reservations", "boolean")}
            <div className="sm:col-span-3">
              <label className="label" htmlFor="blackout">
                Blackout dates (comma separated YYYY-MM-DD)
              </label>
              <input
                id="blackout"
                className="input"
                value={str((settings.reservation as Json)?.blackoutDates)}
                onChange={(event) => setGroup("reservation", "blackoutDates", event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {tab === "ordering" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {groupField("ordering", "deliveryEnabled", "Delivery ordering", "boolean")}
            {groupField("ordering", "pickupEnabled", "Pickup ordering", "boolean")}
            {groupField("ordering", "dineInEnabled", "Dine-in ordering", "boolean")}
            {groupField("ordering", "tableQrEnabled", "Table QR ordering", "boolean")}
            {groupField("ordering", "schedulingEnabled", "Order scheduling", "boolean")}
            {groupField("ordering", "minLeadTimeMinutes", "Minimum lead time (minutes)")}
            {groupField("ordering", "maxScheduleDays", "Maximum scheduling (days)")}
            {groupField("ordering", "cancellationWindowMinutes", "Cancellation window (minutes)")}
            {groupField("ordering", "allowCancelAfterPrep", "Allow cancellation after preparation starts", "boolean")}
            {groupField("ordering", "reviewsRequireApproval", "Reviews require approval", "boolean")}
            {groupField("ordering", "quickAddEnabled", "Quick add on menu cards", "boolean")}
            {groupField("ordering", "supportPhone", "Support phone", "text")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- reports -- */

export function ReportsView() {
  const [preset, setPreset] = useState("monthly");
  const [data, setData] = useState<Json | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const payload = await api<Json>(`/api/admin/reports?preset=${preset}`);
        setData(payload);
      } finally {
        setLoading(false);
      }
    })();
  }, [preset]);

  if (loading || !data) return <div className="skeleton h-72 w-full" />;

  const kpis = (data.kpis as { orders: number; revenue: number; average_order_value: number; cancelled: number; paid_orders: number }) ?? {
    orders: 0,
    revenue: 0,
    average_order_value: 0,
    cancelled: 0,
    paid_orders: 0,
  };
  const sales = (data.salesByDay as { day: string; orders: number; revenue: number }[]) ?? [];
  const topDishes = (data.topDishes as { name: string; quantity: number; revenue: number }[]) ?? [];
  const categories = (data.categorySales as { category: string; quantity: number; revenue: number }[]) ?? [];
  const types = (data.orderTypeBreakdown as { label: string; count: number; revenue: number }[]) ?? [];
  const payments = (data.paymentBreakdown as { label: string; count: number; revenue: number }[]) ?? [];
  const peak = (data.peakHours as { hour: number; orders: number }[]) ?? [];
  const maxRevenue = Math.max(1, ...sales.map((row) => row.revenue));
  const maxOrders = Math.max(1, ...peak.map((row) => row.orders));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl">Reports & analytics</h1>
        <select className="select ml-auto w-44" value={preset} onChange={(event) => setPreset(event.target.value)}>
          <option value="daily">Today</option>
          <option value="weekly">Last 7 days</option>
          <option value="monthly">Last 30 days</option>
        </select>
        {[
          ["orders", "Orders"],
          ["customers", "Customers"],
          ["menu", "Menu"],
          ["inventory", "Inventory"],
          ["refunds", "Refunds"],
          ["reservations", "Reservations"],
        ].map(([type, label]) => (
          <a key={type} className="badge badge-muted px-3 py-1.5 text-xs" href={`/api/admin/export?type=${type}`}>
            {label} CSV
          </a>
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Orders", value: kpis.orders },
          { label: "Revenue", value: formatINR(kpis.revenue) },
          { label: "Average order value", value: formatINR(kpis.average_order_value) },
          { label: "Cancelled / rejected", value: kpis.cancelled },
          { label: "Paid orders", value: kpis.paid_orders },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="label">{kpi.label}</p>
            <p className="font-display text-2xl">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="card mt-5 p-5">
        <h2 className="font-display text-xl">Revenue over time</h2>
        <div className="mt-4 flex h-40 items-end gap-1">
          {sales.map((row) => (
            <div key={row.day} className="group flex flex-1 flex-col items-center justify-end">
              <div className="w-full rounded-t bg-ember/80 transition group-hover:bg-ember" style={{ height: `${(row.revenue / maxRevenue) * 100}%` }} title={`${row.day}: ${formatINR(row.revenue)} · ${row.orders} orders`} />
            </div>
          ))}
          {!sales.length ? <p className="text-sm text-ink/55">No sales in this period.</p> : null}
        </div>
        <p className="mt-2 text-xs text-ink/50">{sales.length ? `${sales[0].day} → ${sales[sales.length - 1].day}` : ""}</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-xl">Top dishes</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {topDishes.map((dish) => (
                <tr key={dish.name} className="border-b border-ink/8">
                  <td className="py-2">{dish.name}</td>
                  <td className="py-2 text-right">{dish.quantity} sold</td>
                  <td className="py-2 text-right">{formatINR(dish.revenue)}</td>
                </tr>
              ))}
              {!topDishes.length ? (
                <tr>
                  <td className="py-2 text-sm text-ink/55">No dish sales in this period.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-xl">Category sales</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {categories.map((row) => (
              <li key={row.category}>
                <div className="flex justify-between">
                  <span>{row.category}</span>
                  <span>{formatINR(row.revenue)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-cream-dark">
                  <div className="h-1.5 rounded-full bg-moss" style={{ width: `${Math.round((row.revenue / Math.max(1, categories[0].revenue)) * 100)}%` }} />
                </div>
              </li>
            ))}
            {!categories.length ? <li className="text-sm text-ink/55">No category data yet.</li> : null}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-xl">Order types & payments</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label">Order type</p>
              <ul className="space-y-1 text-sm">
                {types.map((row) => (
                  <li key={row.label} className="flex justify-between">
                    <span className="capitalize">{row.label}</span>
                    <span>{row.count} · {formatINR(row.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="label">Payment method</p>
              <ul className="space-y-1 text-sm">
                {payments.map((row) => (
                  <li key={row.label} className="flex justify-between">
                    <span className="uppercase">{row.label}</span>
                    <span>{row.count} · {formatINR(row.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-xl">Peak ordering hours</h2>
          <div className="mt-4 flex h-32 items-end gap-1">
            {peak.map((row) => (
              <div key={row.hour} className="flex flex-1 flex-col items-center justify-end">
                <div className="w-full rounded-t bg-moss/80" style={{ height: `${(row.orders / maxOrders) * 100}%` }} title={`${row.hour}:00 · ${row.orders} orders`} />
                <span className="mt-1 text-[10px] text-ink/50">{row.hour}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink/55">
            Discounts: {formatINR(Number((data.discounts as Json)?.discounts ?? 0))} · Delivery fees: {formatINR(Number((data.fees as Json)?.delivery_fees ?? 0))} ·
            Taxes: {formatINR(Number((data.fees as Json)?.taxes ?? 0))}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- misc --- */

export function TableQrPanel({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const url = useMemo(() => `${typeof window === "undefined" ? "" : window.location.origin}/api/admin/qr?code=${code}`, [code]);
  return (
    <span>
      <button type="button" className="btn btn-outline px-2 py-1 text-[11px]" onClick={() => setOpen((value) => !value)}>
        QR
      </button>
      {open ? (
        <span className="mt-2 block rounded-xl border border-ink/10 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`QR code for table ${code}`} className="h-32 w-32" />
        </span>
      ) : null}
    </span>
  );
}

export function useAdminSession() {
  const router = useRouter();
  const [admin, setAdmin] = useState<{ id: number; name: string; email: string; isSuperAdmin: boolean; roleName: string; permissions: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ admin: typeof admin }>("/api/admin/auth");
      setAdmin(data.admin ?? null);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = async () => {
    await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    setAdmin(null);
    router.push("/admin/login");
  };

  return { admin, loading, refresh, logout };
}
