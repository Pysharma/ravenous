"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/site/CartProvider";
import { formatINR } from "@/lib/format";

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

type PaymentOption = { id: string; label: string; description: string; enabled: boolean };
type PublicSettings = {
  payment: Record<string, boolean | string>;
  delivery: { enabled: boolean; codEnabled: boolean; contactlessEnabled: boolean };
  ordering: { deliveryEnabled: boolean; pickupEnabled: boolean; dineInEnabled: boolean; schedulingEnabled: boolean; minLeadTimeMinutes: number; maxScheduleDays: number };
  open: { open: boolean; acceptOrders: boolean; canSchedule: boolean; message: string | null };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export default function CheckoutPage() {
  const { lines, quote, couponCode, brand, user, clearCart, toast } = useCart();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [orderType, setOrderType] = useState<"delivery" | "pickup" | "dinein">("delivery");
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [tableCode, setTableCode] = useState("");
  const [note, setNote] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [contactless, setContactless] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [scheduledFor, setScheduledFor] = useState("");
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (user) {
      setName((current) => current || user.name);
      setPhone((current) => current || user.phone || "");
      setEmail((current) => current || user.email);
    }
  }, [user]);

  useEffect(() => {
    void (async () => {
      const [settingsResponse, addressResponse] = await Promise.all([
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/addresses", { cache: "no-store" }),
      ]);
      if (settingsResponse.ok) setSettings((await settingsResponse.json()) as PublicSettings);
      if (addressResponse.ok) {
        const data = (await addressResponse.json()) as { addresses: Address[] };
        setAddresses(data.addresses ?? []);
        const preferred = data.addresses.find((address) => address.isDefault) ?? data.addresses[0];
        if (preferred) setAddressId(preferred.id);
      }
    })();
  }, []);

  const paymentOptions: PaymentOption[] = useMemo(() => {
    const payment = settings?.payment ?? {};
    const onlineEnabled = payment.onlineEnabled !== false;
    return [
      { id: "upi", label: "UPI / Online payment", description: "Razorpay secure checkout · UPI, cards, net banking, wallets", enabled: onlineEnabled },
      { id: "cod", label: "Cash on Delivery", description: "Pay the delivery partner in cash", enabled: Boolean(settings?.delivery?.codEnabled) },
      { id: "counter", label: "Pay at Restaurant", description: "Settle at the counter (pickup / dine-in)", enabled: true },
    ];
  }, [settings]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast("Location is not available on this device.", "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch("/api/geo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, subtotal: quote?.subtotal ?? 0 }),
          });
          const data = (await response.json()) as { serviceable?: boolean; distanceKm?: number | null; message?: string };
          toast(
            data.serviceable
              ? `Location set · ${data.distanceKm ?? "?"} km from Ravenous`
              : data.message ?? "We could not use that location.",
            data.serviceable ? "success" : "error",
          );
          setAddressId(null);
        } catch {
          toast("We could not verify that location.", "error");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast("Location permission denied. Please add your address manually.", "error");
      },
      { timeout: 8000 },
    );
  };

  const placeOrder = async () => {
    setError(null);
    if (!lines.length) {
      setError("Your cart is empty.");
      return;
    }
    if (!name || !phone) {
      setError("Please enter your name and phone number.");
      return;
    }
    if (orderType === "delivery" && !addressId) {
      setError("Please select or add a delivery address.");
      return;
    }
    if (orderType === "dinein" && !tableCode) {
      setError("Please scan your table QR or enter the table code.");
      return;
    }
    setPlacing(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((line) => ({
            menuItemId: line.menuItemId,
            variantId: line.variantId,
            quantity: line.quantity,
            addonIds: line.addons.map((a) => a.addonId),
            notes: line.notes,
          })),
          orderType,
          name,
          phone,
          email: email || undefined,
          addressId: orderType === "delivery" ? addressId : null,
          tableCode: orderType === "dinein" ? tableCode : null,
          note: note || null,
          deliveryInstructions: deliveryInstructions || null,
          paymentMethod,
          couponCode: couponCode ?? null,
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
          contactless,
        }),
      });
      const data = (await response.json()) as { order?: { id: number; orderCode: string; paymentMethod: string }; error?: string; nextStep?: string };
      if (!response.ok || !data.order) {
        throw new Error(data.error ?? "We could not place your order. Please try again.");
      }
      const orderId = data.order.id;
      if (data.nextStep === "payment") {
        const paymentResponse = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", orderId }),
        });
        const paymentData = (await paymentResponse.json()) as {
          gateway?: string;
          keyId?: string | null;
          gatewayOrderId?: string | null;
          notice?: string | null;
        };
        if (paymentData.gateway === "razorpay" && paymentData.keyId && paymentData.gatewayOrderId && typeof window !== "undefined") {
          await new Promise<void>((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve();
            script.onerror = () => resolve();
            document.body.appendChild(script);
          });
          if (window.Razorpay) {
            const gateway = new window.Razorpay({
              key: paymentData.keyId,
              amount: quote?.total ?? 0,
              currency: "INR",
              name: brand.name,
              description: `Order ${data.order.orderCode}`,
              order_id: paymentData.gatewayOrderId,
              theme: { color: "#d9673a" },
              handler: async (response) => {
                await fetch("/api/payments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "verify",
                    orderId,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpaySignature: response.razorpay_signature,
                  }),
                });
                router.push(`/order-confirmation/${orderId}`);
              },
              modal: { ondismiss: () => router.push(`/order-confirmation/${orderId}`) },
            });
            gateway.open();
            clearCart();
            return;
          }
        }
        toast(paymentData.notice ?? "Payment is pending verification by the restaurant.", "info");
      }
      clearCart();
      router.push(`/order-confirmation/${orderId}`);
    } catch (placeError) {
      setError(placeError instanceof Error ? placeError.message : "Something went wrong. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (!lines.length) {
    return (
      <div className="container-page py-20 text-center">
        <p className="font-display text-3xl">Your cart is hungry. 🍽️</p>
        <p className="mt-2 text-sm text-ink/60">Add something delicious to get started.</p>
        <Link href="/menu" className="btn btn-primary mt-6">
          Explore Menu
        </Link>
      </div>
    );
  }

  const steps = ["Order type", "Your details", orderType === "dinein" ? "Table" : "Address", "Summary", "Coupon", "Payment"];

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[1.5fr_1fr]">
      <section>
        <h1 className="font-display text-3xl">Checkout</h1>
        <ol className="mt-4 flex flex-wrap gap-2 text-xs">
          {steps.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => setStep(index + 1)}
                className={`badge border ${step === index + 1 ? "border-ember bg-ember/15 text-[#9c3f1c]" : "border-ink/12 text-ink/60"}`}
              >
                {index + 1}. {label}
              </button>
            </li>
          ))}
        </ol>

        {settings?.open.message ? (
          <p className="mt-4 rounded-2xl bg-[#fff5e1] p-3 text-xs text-[#93610c]">{settings.open.message}</p>
        ) : null}

        {step === 1 ? (
          <div className="card mt-5 p-5">
            <h2 className="font-display text-xl">How would you like your order?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { id: "delivery", label: "Delivery", description: "To your doorstep", enabled: settings?.ordering.deliveryEnabled !== false },
                { id: "pickup", label: "Pickup", description: "Collect from Ravenous", enabled: settings?.ordering.pickupEnabled !== false },
                { id: "dinein", label: "Dine-in", description: "Order at your table", enabled: settings?.ordering.dineInEnabled !== false },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={!option.enabled}
                  onClick={() => setOrderType(option.id as typeof orderType)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    orderType === option.id ? "border-ember bg-ember/10" : "border-ink/12 hover:border-ink/25"
                  } ${option.enabled ? "" : "opacity-45"}`}
                >
                  <p className="font-semibold">{option.label}</p>
                  <p className="text-xs text-ink/60">{option.description}</p>
                </button>
              ))}
            </div>
            {orderType === "pickup" ? (
              <p className="mt-4 text-sm text-ink/70">
                Pickup from {brand.address} · Estimated preparation {quote?.prepTimeMinutes ?? 25} minutes.
              </p>
            ) : null}
            {settings?.ordering.schedulingEnabled ? (
              <div className="mt-4">
                <label className="label" htmlFor="schedule">
                  Schedule for later (optional)
                </label>
                <input
                  id="schedule"
                  type="datetime-local"
                  className="input"
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                />
                <p className="mt-1 text-xs text-ink/50">
                  Minimum lead time {settings.ordering.minLeadTimeMinutes} minutes. Leave blank to order now.
                </p>
              </div>
            ) : null}
            <button type="button" className="btn btn-primary mt-5" onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="card mt-5 p-5">
            <h2 className="font-display text-xl">Your details</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="checkout-name">
                  Name
                </label>
                <input id="checkout-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="checkout-phone">
                  Phone
                </label>
                <input id="checkout-phone" className="input" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="checkout-email">
                  Email (for invoice and updates)
                </label>
                <input id="checkout-email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="checkout-note">
                  Special instructions for the kitchen
                </label>
                <textarea id="checkout-note" className="textarea" rows={2} value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="card mt-5 p-5">
            <h2 className="font-display text-xl">{orderType === "dinein" ? "Table details" : "Delivery address"}</h2>
            {orderType === "dinein" ? (
              <div className="mt-4">
                <label className="label" htmlFor="table-code">
                  Table code (from the QR at your table)
                </label>
                <input id="table-code" className="input" value={tableCode} onChange={(event) => setTableCode(event.target.value.toUpperCase())} placeholder="RV-T01" />
                <p className="mt-2 text-xs text-ink/55">
                  Scanning the QR at your table opens the dine-in menu automatically. Ask our staff if you need help.
                </p>
              </div>
            ) : orderType === "delivery" ? (
              <div className="mt-4 space-y-3">
                <button type="button" className="btn btn-outline" onClick={useCurrentLocation} disabled={locating}>
                  {locating ? "Locating…" : "📍 Use Current Location"}
                </button>
                {addresses.length ? (
                  <ul className="space-y-2">
                    {addresses.map((address) => (
                      <li key={address.id}>
                        <label className={`flex cursor-pointer gap-3 rounded-2xl border p-3 text-sm ${addressId === address.id ? "border-ember bg-ember/10" : "border-ink/12"}`}>
                          <input type="radio" name="address" checked={addressId === address.id} onChange={() => setAddressId(address.id)} />
                          <span>
                            <span className="badge badge-muted mr-2">{address.label}</span>
                            <span className="font-medium">{address.fullName}</span>
                            <span className="block text-xs text-ink/60">
                              {[address.house, address.street, address.locality, address.city, address.pincode].filter(Boolean).join(", ")}
                            </span>
                            <span className="block text-xs text-ink/45">{address.phone}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink/60">
                    No saved addresses yet.{" "}
                    <Link href="/account/addresses" className="font-semibold underline">
                      Add an address
                    </Link>{" "}
                    to continue with delivery.
                  </p>
                )}
                <div>
                  <label className="label" htmlFor="delivery-instructions">
                    Delivery notes
                  </label>
                  <input
                    id="delivery-instructions"
                    className="input"
                    placeholder="Call when you arrive / Leave at gate / Do not ring bell"
                    value={deliveryInstructions}
                    onChange={(event) => setDeliveryInstructions(event.target.value)}
                  />
                </div>
                {settings?.delivery.contactlessEnabled ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={contactless} onChange={(event) => setContactless(event.target.checked)} />
                    Contactless delivery
                  </label>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink/70">
                Pickup from {brand.address}. Please carry your order ID {brand.phone ? `or call ${brand.phone}` : ""}.
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(4)}>
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="card mt-5 p-5">
            <h2 className="font-display text-xl">Order summary</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {lines.map((line) => (
                <li key={line.key} className="flex justify-between">
                  <span>
                    {line.quantity} × {line.name}
                    {line.variantName ? ` (${line.variantName})` : ""}
                    {line.addons.length ? ` + ${line.addons.map((a) => a.name).join(", ")}` : ""}
                  </span>
                  <span>{formatINR(line.unitPrice + line.addonsTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setStep(3)}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(6)}>
                Continue to payment
              </button>
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="card mt-5 p-5">
            <h2 className="font-display text-xl">Payment</h2>
            <div className="mt-4 space-y-2">
              {paymentOptions.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer gap-3 rounded-2xl border p-3 text-sm ${
                    paymentMethod === option.id ? "border-ember bg-ember/10" : "border-ink/12"
                  } ${option.enabled ? "" : "opacity-45"}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    disabled={!option.enabled}
                    checked={paymentMethod === option.id}
                    onChange={() => setPaymentMethod(option.id)}
                  />
                  <span>
                    <span className="font-medium">{option.label}</span>
                    <span className="block text-xs text-ink/60">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink/55">
              Online payments are confirmed only after the payment gateway verifies the transaction. Cash and pay-at-restaurant orders are marked
              as pending until collected.
            </p>
            {error ? <p className="mt-4 rounded-2xl bg-[#fdecea] p-3 text-sm text-[#a12622]">{error}</p> : null}
            <div className="mt-5 flex gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setStep(4)}>
                Back
              </button>
              <button type="button" className="btn btn-primary py-3 text-base" onClick={placeOrder} disabled={placing}>
                {placing ? "Placing order…" : `Place order · ${quote ? formatINR(quote.total) : ""}`}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="card p-5">
          <h2 className="font-display text-xl">Bill details</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink/65">Subtotal</dt><dd>{quote ? formatINR(quote.subtotal) : "—"}</dd></div>
            {quote && quote.discountTotal > 0 ? (
              <div className="flex justify-between text-[#23663a]"><dt>Discount</dt><dd>−{formatINR(quote.discountTotal)}</dd></div>
            ) : null}
            <div className="flex justify-between"><dt className="text-ink/65">Taxes</dt><dd>{quote ? formatINR(quote.taxTotal) : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/65">Packaging</dt><dd>{quote ? formatINR(quote.packagingFee) : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/65">Delivery (once per order)</dt><dd>{quote ? formatINR(quote.deliveryFee) : "—"}</dd></div>
            <div className="flex justify-between border-t border-ink/10 pt-2 font-display text-xl"><dt>Total</dt><dd>{quote ? formatINR(quote.total) : "—"}</dd></div>
          </dl>
          {quote?.etaMinutes ? <p className="mt-3 text-xs text-ink/55">Estimated {orderType === "delivery" ? "arrival" : "ready"} in about {quote.etaMinutes} minutes.</p> : null}
          <p className="mt-3 text-xs text-ink/45">
            Totals are calculated by our server from live menu prices, coupons, taxes and delivery rules — never from the browser.
          </p>
        </div>
      </aside>
    </div>
  );
}
