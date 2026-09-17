import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  addons as addonsTable,
  couponRedemptions,
  coupons as couponsTable,
  deliveryZones,
  menuItemAddons,
  menuItems,
  menuVariants,
  orders as ordersTable,
  type Coupon,
} from "@/db/schema";
import { bad } from "@/lib/api";
import { isWithinWindow, packagingFeeFor, quoteDelivery } from "@/lib/delivery";
import { deliverySettings, getSettings, taxSettings } from "@/lib/settings";

export type OrderType = "delivery" | "pickup" | "dinein";

export type CartInputLine = {
  menuItemId: number;
  variantId?: number | null;
  quantity: number;
  addonIds?: number[];
  notes?: string | null;
};

export type PricedLineAddon = { addonId: number; name: string; price: number; quantity: number };

export type PricedLine = {
  menuItemId: number;
  variantId: number | null;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  variantName: string | null;
  foodType: string;
  unitPrice: number;
  mrp: number;
  quantity: number;
  addons: PricedLineAddon[];
  addonsTotal: number;
  taxRate: number;
  lineSubtotal: number;
  prepTimeMinutes: number;
  notes: string | null;
  spiceLevel: string;
  isAvailable: boolean;
};

export type PricedCart = {
  orderType: OrderType;
  lines: PricedLine[];
  itemCount: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  packagingFee: number;
  deliveryFee: number;
  deliveryTax: number;
  total: number;
  couponCode: string | null;
  couponMessage: string | null;
  couponId: number | null;
  freeDelivery: boolean;
  distanceKm: number | null;
  zoneName: string | null;
  serviceable: boolean;
  serviceMessage: string | null;
  minOrderPaise: number;
  belowMinimum: boolean;
  prepTimeMinutes: number;
  issues: string[];
  etaMinutes: number;
};

export type CouponCheck = {
  ok: boolean;
  message: string;
  coupon: Coupon | null;
  discount: number;
  freeDelivery: boolean;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function validateCoupon(input: {
  code: string;
  subtotal: number;
  orderType: OrderType;
  userId?: number | null;
  at?: Date;
  itemSubtotals?: { menuItemId: number; categoryId: number | null; amount: number }[];
  deliveryFee?: number;
}): Promise<CouponCheck> {
  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, message: "Enter a coupon code.", coupon: null, discount: 0, freeDelivery: false };
  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, code)).limit(1);
  if (!coupon || !coupon.isActive) {
    return { ok: false, message: "This coupon code is not valid.", coupon: null, discount: 0, freeDelivery: false };
  }
  const now = input.at ?? new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { ok: false, message: "This coupon is not active yet.", coupon, discount: 0, freeDelivery: false };
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    return { ok: false, message: "This coupon has expired.", coupon, discount: 0, freeDelivery: false };
  }
  if (coupon.orderTypes && !coupon.orderTypes.split(",").map((t) => t.trim()).includes(input.orderType)) {
    return {
      ok: false,
      message: "This coupon is not applicable for the selected order type.",
      coupon,
      discount: 0,
      freeDelivery: false,
    };
  }
  if (coupon.daysOfWeek && coupon.daysOfWeek.trim()) {
    const allowed = coupon.daysOfWeek.split(",").map((d) => d.trim().toLowerCase());
    if (!allowed.includes(DAY_NAMES[now.getDay()].toLowerCase())) {
      return { ok: false, message: "This coupon is not available today.", coupon, discount: 0, freeDelivery: false };
    }
  }
  if (coupon.startTime && coupon.endTime && !isWithinWindow(now, coupon.startTime, coupon.endTime)) {
    return {
      ok: false,
      message: `This coupon is only valid between ${coupon.startTime} and ${coupon.endTime}.`,
      coupon,
      discount: 0,
      freeDelivery: false,
    };
  }
  if (coupon.minOrder && input.subtotal < coupon.minOrder) {
    return {
      ok: false,
      message: `Minimum order for this coupon is ₹${(coupon.minOrder / 100).toFixed(0)}.`,
      coupon,
      discount: 0,
      freeDelivery: false,
    };
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return {
      ok: false,
      message: "This coupon has reached its usage limit.",
      coupon,
      discount: 0,
      freeDelivery: false,
    };
  }
  if (input.userId) {
    const used = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponRedemptions)
      .where(and(eq(couponRedemptions.couponId, coupon.id), eq(couponRedemptions.userId, input.userId)));
    if (coupon.perUserLimit > 0 && (used[0]?.count ?? 0) >= coupon.perUserLimit) {
      return {
        ok: false,
        message: "You have already used this coupon.",
        coupon,
        discount: 0,
        freeDelivery: false,
      };
    }
    if (coupon.firstOrderOnly) {
      const prior = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(ordersTable)
        .where(eq(ordersTable.userId, input.userId));
      if ((prior[0]?.count ?? 0) > 0) {
        return {
          ok: false,
          message: "This coupon is only for first orders.",
          coupon,
          discount: 0,
          freeDelivery: false,
        };
      }
    }
  } else if (coupon.firstOrderOnly) {
    return {
      ok: false,
      message: "Sign in to use this first-order coupon.",
      coupon,
      discount: 0,
      freeDelivery: false,
    };
  }

  let eligibleAmount = input.subtotal;
  if (coupon.appliesTo === "category" && coupon.categoryId) {
    eligibleAmount = (input.itemSubtotals ?? [])
      .filter((l) => l.categoryId === coupon.categoryId)
      .reduce((sum, l) => sum + l.amount, 0);
    if (!eligibleAmount) {
      return {
        ok: false,
        message: "This coupon applies to specific categories only. Add eligible items to use it.",
        coupon,
        discount: 0,
        freeDelivery: false,
      };
    }
  }
  if (coupon.appliesTo === "item" && coupon.menuItemId) {
    eligibleAmount = (input.itemSubtotals ?? [])
      .filter((l) => l.menuItemId === coupon.menuItemId)
      .reduce((sum, l) => sum + l.amount, 0);
    if (!eligibleAmount) {
      return {
        ok: false,
        message: "This coupon applies to a specific dish only.",
        coupon,
        discount: 0,
        freeDelivery: false,
      };
    }
  }

  let discount = 0;
  let freeDelivery = false;
  if (coupon.discountType === "percent") {
    discount = Math.round((eligibleAmount * coupon.discountValue) / 100);
  } else if (coupon.discountType === "fixed") {
    discount = Math.min(coupon.discountValue, eligibleAmount);
  } else if (coupon.discountType === "free_delivery") {
    freeDelivery = true;
    discount = 0;
  }
  if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) discount = coupon.maxDiscount;
  discount = Math.max(0, Math.min(discount, input.subtotal));

  const label =
    coupon.discountType === "free_delivery"
      ? "Free delivery applied"
      : `Coupon applied — you saved ₹${(discount / 100).toFixed(0)}`;
  return { ok: true, message: label, coupon, discount, freeDelivery };
}

export function resolveEtaMinutes(orderType: OrderType, prepTimeMinutes: number, distanceKm: number | null, busyExtra: number) {
  const prep = prepTimeMinutes + Math.max(0, busyExtra);
  if (orderType === "delivery") {
    const travel = distanceKm && distanceKm > 0 ? Math.ceil(distanceKm * 3) : 15;
    return prep + travel + 10;
  }
  if (orderType === "pickup") return prep + 10;
  return prep + 5;
}

export async function priceCart(input: {
  lines: CartInputLine[];
  orderType: OrderType;
  couponCode?: string | null;
  userId?: number | null;
  distanceKm?: number | null;
  pincode?: string | null;
  at?: Date;
}): Promise<PricedCart> {
  const settings = await getSettings();
  const tax = taxSettings(settings);
  const delivery = deliverySettings(settings);
  const lines = (input.lines ?? []).filter((l) => l.menuItemId && l.quantity > 0);

  if (!lines.length) bad("Your cart is empty.");

  const itemIds = [...new Set(lines.map((l) => l.menuItemId))];
  const items = await db
    .select()
    .from(menuItems)
    .where(and(inArray(menuItems.id, itemIds), sql`${menuItems.deletedAt} is null`));
  const variants = await db.select().from(menuVariants).where(inArray(menuVariants.menuItemId, itemIds));
  const itemAddonRows = await db
    .select({ addon: addonsTable })
    .from(menuItemAddons)
    .innerJoin(addonsTable, eq(addonsTable.id, menuItemAddons.addonId))
    .where(inArray(menuItemAddons.menuItemId, itemIds));

  const issues: string[] = [];
  let prepTimeMinutes = 0;
  const pricedLines: PricedLine[] = [];

  for (const line of lines) {
    const item = items.find((i) => i.id === line.menuItemId);
    if (!item) {
      issues.push("One of the dishes in your cart is no longer on the menu.");
      continue;
    }
    const itemVariants = variants
      .filter((v) => v.menuItemId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price);
    const variant = line.variantId
      ? itemVariants.find((v) => v.id === line.variantId) ?? null
      : itemVariants.find((v) => v.isDefault) ?? itemVariants[0] ?? null;
    const available = item.isAvailable && (variant ? variant.isAvailable : true);
    if (!available) {
      issues.push(`${item.name} is currently unavailable.`);
    }
    const allowedAddons = itemAddonRows.filter((r) => r.addon.isActive && r.addon.id);
    const addonIds = (line.addonIds ?? []).filter((id) => allowedAddons.some((r) => r.addon.id === id));
    const lineAddons: PricedLineAddon[] = addonIds.map((id) => {
      const found = allowedAddons.find((r) => r.addon.id === id)!;
      return { addonId: found.addon.id, name: found.addon.name, price: found.addon.price, quantity: 1 };
    });
    const addonsTotal = lineAddons.reduce((sum, a) => sum + a.price * a.quantity, 0);
    const unitPrice = variant ? variant.price : item.basePrice;
    const mrp = variant ? Math.max(variant.mrp, variant.price) : Math.max(item.mrp, item.basePrice);
    const quantity = Math.min(Math.max(Math.round(line.quantity), 1), 30);
    const lineSubtotal = (unitPrice + addonsTotal) * quantity;
    const linePrep = (variant?.prepTimeMinutes || item.prepTimeMinutes || 20) + (addonsTotal ? 2 : 0);
    prepTimeMinutes = Math.max(prepTimeMinutes, linePrep);

    pricedLines.push({
      menuItemId: item.id,
      variantId: variant?.id ?? null,
      name: item.name,
      slug: item.slug,
      imageUrl: item.imageUrl,
      variantName: variant?.name ?? null,
      foodType: item.foodType,
      unitPrice,
      mrp,
      quantity,
      addons: lineAddons,
      addonsTotal,
      taxRate: tax.gstEnabled ? item.taxRate ?? tax.defaultRate : 0,
      lineSubtotal,
      prepTimeMinutes: linePrep,
      notes: line.notes ?? null,
      spiceLevel: item.spiceLevel,
      isAvailable: available,
    });
  }

  if (!pricedLines.length) bad("None of the dishes in your cart are available right now.");

  const itemCount = pricedLines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = pricedLines.reduce((sum, l) => sum + l.lineSubtotal, 0);

  let discountTotal = 0;
  let freeDelivery = false;
  let couponCode: string | null = null;
  let couponMessage: string | null = null;
  let couponId: number | null = null;

  if (input.couponCode) {
    const check = await validateCoupon({
      code: input.couponCode,
      subtotal,
      orderType: input.orderType,
      userId: input.userId ?? null,
      at: input.at,
      itemSubtotals: pricedLines.map((l) => ({
        menuItemId: l.menuItemId,
        categoryId: items.find((i) => i.id === l.menuItemId)?.categoryId ?? null,
        amount: l.lineSubtotal,
      })),
    });
    if (check.ok && check.coupon) {
      discountTotal = check.discount;
      freeDelivery = check.freeDelivery;
      couponCode = check.coupon.code;
      couponMessage = check.message;
      couponId = check.coupon.id;
    } else {
      couponMessage = check.message;
    }
  }

  const packagingFee = packagingFeeFor(itemCount, delivery);

  let deliveryFee = 0;
  let deliveryTax = 0;
  let distanceKm: number | null = input.distanceKm ?? null;
  let zoneName: string | null = null;
  let serviceable = true;
  let serviceMessage: string | null = null;
  let minOrderPaise =
    input.orderType === "delivery" ? delivery.minOrderDelivery : delivery.minOrderPickup;

  if (input.orderType === "delivery") {
    const zones = await db.select().from(deliveryZones);
    const quote = quoteDelivery({
      distanceKm: input.distanceKm ?? null,
      pincode: input.pincode ?? null,
      subtotal,
      settings: delivery,
      zones,
      at: input.at,
    });
    deliveryFee = quote.feePaise;
    distanceKm = quote.distanceKm;
    zoneName = quote.zoneName;
    serviceable = quote.serviceable;
    serviceMessage = quote.message ?? null;
    minOrderPaise = Math.max(minOrderPaise, quote.minOrderPaise);
  }
  if (freeDelivery) deliveryFee = 0;

  // tax on discounted line amounts, allocated proportionally
  let taxTotal = 0;
  const discountRatio = subtotal > 0 ? Math.min(discountTotal / subtotal, 1) : 0;
  for (const line of pricedLines) {
    const taxable = Math.max(0, Math.round(line.lineSubtotal * (1 - discountRatio)));
    taxTotal += Math.round((taxable * line.taxRate) / 100);
  }
  if (tax.packagingTaxRate > 0) taxTotal += Math.round((packagingFee * tax.packagingTaxRate) / 100);
  if (tax.deliveryTaxRate > 0) {
    deliveryTax = Math.round((deliveryFee * tax.deliveryTaxRate) / 100);
    taxTotal += deliveryTax;
  }

  const belowMinimum = input.orderType !== "dinein" && subtotal < minOrderPaise;
  const total = Math.max(0, subtotal - discountTotal + taxTotal + packagingFee + deliveryFee);

  return {
    orderType: input.orderType,
    lines: pricedLines,
    itemCount,
    subtotal,
    discountTotal,
    taxTotal,
    packagingFee,
    deliveryFee,
    deliveryTax,
    total,
    couponCode,
    couponMessage,
    couponId,
    freeDelivery,
    distanceKm,
    zoneName,
    serviceable,
    serviceMessage,
    minOrderPaise,
    belowMinimum,
    prepTimeMinutes,
    issues,
    etaMinutes: resolveEtaMinutes(
      input.orderType,
      prepTimeMinutes,
      distanceKm,
      settings.status === "busy" ? settings.busyExtraMinutes : 0,
    ),
  };
}


