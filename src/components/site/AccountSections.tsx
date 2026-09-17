"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/site/CartProvider";
import { formatINR, formatDateTime } from "@/lib/format";

type Address = {
  id: number;
  label: string;
  fullName: string;
  phone: string;
  house: string | null;
  street: string | null;
  locality: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  latitude: string | null;
  longitude: string | null;
  instructions: string | null;
  isDefault: boolean;
};

type Favorite = { id: number; name: string; slug: string; basePrice: number; imageUrl: string | null; isAvailable: boolean; variants: { id: number; name: string; price: number; isDefault: boolean }[] };

type Reservation = { id: number; code: string; date: string; time: string; guests: number; status: string; specialRequest: string | null };

type Notification = { id: number; title: string; body: string | null; link: string | null; isRead: boolean; createdAt: string; type: string };

type Ticket = { id: number; code: string; category: string; status: string; message: string; createdAt: string; resolutionNotes: string | null };

const EMPTY_ADDRESS = {
  label: "Home",
  fullName: "",
  phone: "",
  house: "",
  street: "",
  locality: "",
  city: "Bilaspur",
  state: "Chhattisgarh",
  pincode: "",
  landmark: "",
  instructions: "",
  latitude: null as number | null,
  longitude: null as number | null,
  isDefault: false,
};

export function AccountSections({ section }: { section: string }) {
  const { toast, addLine, favorites, toggleFavorite } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<Favorite[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY_ADDRESS });
  const [ticketForm, setTicketForm] = useState({ name: "", phone: "", category: "other", message: "" });

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        if (section === "addresses") {
          const response = await fetch("/api/addresses", { cache: "no-store" });
          const data = (await response.json()) as { addresses: Address[] };
          setAddresses(data.addresses ?? []);
        } else if (section === "favorites") {
          const response = await fetch("/api/favorites", { cache: "no-store" });
          const data = (await response.json()) as { favorites: Favorite[] };
          setFavoriteItems(data.favorites ?? []);
        } else if (section === "reservations") {
          const response = await fetch("/api/reservations", { cache: "no-store" });
          const data = (await response.json()) as { reservations: Reservation[] };
          setReservations(data.reservations ?? []);
        } else if (section === "notifications") {
          const response = await fetch("/api/notifications", { cache: "no-store" });
          const data = (await response.json()) as { notifications: Notification[] };
          setNotifications(data.notifications ?? []);
          await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ all: true, audience: "customer" }),
          });
        } else if (section === "support") {
          const response = await fetch("/api/support", { cache: "no-store" });
          const data = (await response.json()) as { tickets: Ticket[] };
          setTickets(data.tickets ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [section]);

  const saveAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { error?: string; address?: Address };
      if (!response.ok) throw new Error(data.error ?? "Could not save the address.");
      setAddresses((prev) => [...prev, data.address!]);
      setForm({ ...EMPTY_ADDRESS });
      toast("Address saved", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the address.", "error");
    }
  };

  const removeAddress = async (id: number) => {
    await fetch(`/api/addresses?id=${id}`, { method: "DELETE" });
    setAddresses((prev) => prev.filter((address) => address.id !== id));
    toast("Address removed", "info");
  };

  const cancelReservation = async (id: number) => {
    await fetch("/api/reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setReservations((prev) => prev.map((reservation) => (reservation.id === id ? { ...reservation, status: "cancelled" } : reservation)));
    toast("Reservation cancelled", "info");
  };

  const submitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticketForm),
      });
      const data = (await response.json()) as { error?: string; ticket?: Ticket; message?: string };
      if (!response.ok || !data.ticket) throw new Error(data.error ?? "Could not create the ticket.");
      setTickets((prev) => [data.ticket!, ...prev]);
      setTicketForm({ name: "", phone: "", category: "other", message: "" });
      toast(data.message ?? "Support ticket created", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not create the ticket.", "error");
    }
  };

  if (loading) return <div className="skeleton h-40 w-full" />;

  if (section === "addresses") {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {addresses.length ? (
            addresses.map((address) => (
              <div key={address.id} className="card p-4">
                <p className="flex items-center gap-2 font-medium">
                  <span className="badge badge-muted">{address.label}</span>
                  {address.fullName}
                  {address.isDefault ? <span className="badge badge-gold">Default</span> : null}
                </p>
                <p className="mt-2 text-sm text-ink/65">
                  {[address.house, address.street, address.locality, address.city, address.state, address.pincode].filter(Boolean).join(", ")}
                </p>
                <p className="text-xs text-ink/50">
                  {address.phone}
                  {address.landmark ? ` · Landmark: ${address.landmark}` : ""}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline px-3 py-1 text-xs"
                    onClick={async () => {
                      await fetch("/api/addresses", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: address.id, isDefault: true }),
                      });
                      setAddresses((prev) => prev.map((entry) => ({ ...entry, isDefault: entry.id === address.id })));
                    }}
                  >
                    Make default
                  </button>
                  <button type="button" className="btn btn-outline px-3 py-1 text-xs text-[#a12622]" onClick={() => void removeAddress(address.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink/60">No saved addresses yet. Add one to place delivery orders.</p>
          )}
        </div>
        <form className="card p-5" onSubmit={saveAddress}>
          <h2 className="font-display text-xl">Add a new address</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { key: "label", label: "Type", options: ["Home", "Work", "Other"] },
            ].map((field) => (
              <div key={field.key}>
                <label className="label" htmlFor={`address-${field.key}`}>
                  {field.label}
                </label>
                <select
                  id={`address-${field.key}`}
                  className="select"
                  value={form.label}
                  onChange={(event) => setForm({ ...form, label: event.target.value })}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {[
              { key: "fullName", label: "Full name", required: true },
              { key: "phone", label: "Phone", required: true },
              { key: "house", label: "House / Flat" },
              { key: "street", label: "Street" },
              { key: "locality", label: "Locality" },
              { key: "city", label: "City", required: true },
              { key: "state", label: "State", required: true },
              { key: "pincode", label: "PIN code", required: true },
              { key: "landmark", label: "Landmark" },
              { key: "instructions", label: "Delivery instructions" },
            ].map((field) => (
              <div key={field.key}>
                <label className="label" htmlFor={`address-${field.key}`}>
                  {field.label}
                </label>
                <input
                  id={`address-${field.key}`}
                  className="input"
                  required={field.required}
                  value={String(form[field.key as keyof typeof form] ?? "")}
                  onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                />
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
              Set as my default delivery address
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary">
              Save address
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                if (!navigator.geolocation) {
                  toast("Location is not available on this device.", "error");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setForm((prev) => ({ ...prev, latitude: position.coords.latitude, longitude: position.coords.longitude }));
                    toast("Location attached to this address", "success");
                  },
                  () => toast("Location permission denied.", "error"),
                );
              }}
            >
              📍 Use Current Location
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (section === "favorites") {
    if (!favoriteItems.length) {
      return (
        <div className="card p-10 text-center">
          <p className="font-display text-2xl">No favourites yet.</p>
          <p className="mt-2 text-sm text-ink/60">Tap the heart on any dish to save it here.</p>
          <Link href="/menu" className="btn btn-primary mt-4">
            Explore Menu
          </Link>
        </div>
      );
    }
    return (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favoriteItems.map((item) => (
          <li key={item.id} className="card p-4">
            <p className="font-medium">{item.name}</p>
            <p className="text-sm text-ink/60">{formatINR(item.variants[0]?.price ?? item.basePrice)}</p>
            <p className={`mt-1 text-xs font-semibold ${item.isAvailable ? "text-[#23663a]" : "text-[#a12622]"}`}>
              {item.isAvailable ? "Available" : "Currently unavailable"}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn btn-primary px-3 py-1 text-xs"
                disabled={!item.isAvailable}
                onClick={() =>
                  addLine({
                    menuItemId: item.id,
                    variantId: item.variants[0]?.id ?? null,
                    name: item.name,
                    slug: item.slug,
                    imageUrl: item.imageUrl,
                    variantName: item.variants[0]?.name ?? null,
                    foodType: "veg",
                    unitPrice: item.variants[0]?.price ?? item.basePrice,
                    addons: [],
                    addonsTotal: 0,
                    quantity: 1,
                    notes: null,
                  })
                }
              >
                Add to cart
              </button>
              <button type="button" className="btn btn-outline px-3 py-1 text-xs" onClick={() => void toggleFavorite(item.id)}>
                {favorites.includes(item.id) ? "Remove ❤️" : "Save 🤍"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (section === "reservations") {
    return (
      <div className="space-y-4">
        {reservations.length ? (
          reservations.map((reservation) => (
            <div key={reservation.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {reservation.code} · {reservation.date} at {reservation.time}
                </p>
                <p className="text-xs text-ink/55">
                  {reservation.guests} guests · {reservation.status}
                  {reservation.specialRequest ? ` · ${reservation.specialRequest}` : ""}
                </p>
              </div>
              {["requested", "confirmed"].includes(reservation.status) ? (
                <button type="button" className="btn btn-outline px-3 py-1 text-xs text-[#a12622]" onClick={() => void cancelReservation(reservation.id)}>
                  Cancel reservation
                </button>
              ) : (
                <span className="badge badge-muted">{reservation.status}</span>
              )}
            </div>
          ))
        ) : (
          <div className="card p-8 text-center">
            <p className="font-display text-xl">No reservations yet.</p>
            <Link href="/reservations" className="btn btn-primary mt-4">
              Book a Table
            </Link>
          </div>
        )}
      </div>
    );
  }

  if (section === "notifications") {
    return (
      <ul className="space-y-3">
        {notifications.length ? (
          notifications.map((notification) => (
            <li key={notification.id} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{notification.title}</p>
                <span className="text-xs text-ink/45">{formatDateTime(notification.createdAt)}</span>
              </div>
              {notification.body ? <p className="mt-1 text-sm text-ink/65">{notification.body}</p> : null}
              {notification.link ? (
                <Link href={notification.link} className="mt-2 inline-block text-xs font-semibold underline">
                  View details
                </Link>
              ) : null}
            </li>
          ))
        ) : (
          <li className="text-sm text-ink/60">No notifications yet. Order updates will appear here.</li>
        )}
      </ul>
    );
  }

  if (section === "support") {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {tickets.length ? (
            tickets.map((ticket) => (
              <div key={ticket.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{ticket.code}</p>
                  <span className="badge badge-muted">{ticket.status.replace("_", " ")}</span>
                </div>
                <p className="mt-1 text-sm text-ink/65">
                  {ticket.category.replace("_", " ")} · {formatDateTime(ticket.createdAt)}
                </p>
                <p className="mt-2 text-sm">{ticket.message}</p>
                {ticket.resolutionNotes ? <p className="mt-2 text-xs text-[#23663a]">Resolution: {ticket.resolutionNotes}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-ink/60">No support tickets yet. Use the form to report an issue with an order.</p>
          )}
        </div>
        <form className="card p-5" onSubmit={submitTicket}>
          <h2 className="font-display text-xl">Report an issue</h2>
          <div className="mt-4 grid gap-3">
            <div>
              <label className="label" htmlFor="ticket-name">
                Your name
              </label>
              <input id="ticket-name" className="input" required value={ticketForm.name} onChange={(event) => setTicketForm({ ...ticketForm, name: event.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ticket-phone">
                Phone
              </label>
              <input id="ticket-phone" className="input" required value={ticketForm.phone} onChange={(event) => setTicketForm({ ...ticketForm, phone: event.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ticket-category">
                Issue type
              </label>
              <select id="ticket-category" className="select" value={ticketForm.category} onChange={(event) => setTicketForm({ ...ticketForm, category: event.target.value })}>
                {[
                  ["missing_item", "Missing item"],
                  ["wrong_item", "Wrong item"],
                  ["quality", "Quality issue"],
                  ["payment", "Payment issue"],
                  ["delivery", "Delivery issue"],
                  ["other", "Other"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ticket-message">
                Describe the issue
              </label>
              <textarea id="ticket-message" className="textarea" rows={4} required value={ticketForm.message} onChange={(event) => setTicketForm({ ...ticketForm, message: event.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary mt-4">
            Submit ticket
          </button>
        </form>
      </div>
    );
  }

  return <p className="text-sm text-ink/60">This section is not available.</p>;
}
