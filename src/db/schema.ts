import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * All monetary values are stored as INTEGER PAISE (1 INR = 100 paise) to avoid
 * floating point drift. Use `formatINR(paise)` for display and `toPaise()`
 * when parsing admin input.
 */

const money = (name: string) => integer(name).notNull().default(0);
const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------------ auth --- */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    status: text("status").notNull().default("active"),
    emailVerified: boolean("email_verified").notNull().default(false),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    avatarUrl: text("avatar_url"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    resetToken: text("reset_token"),
    resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_phone_idx").on(t.phone)],
);

export const addresses = pgTable(
  "addresses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("Home"),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    house: text("house"),
    street: text("street"),
    locality: text("locality"),
    city: text("city").notNull().default("Bilaspur"),
    state: text("state").notNull().default("Chhattisgarh"),
    pincode: text("pincode").notNull(),
    landmark: text("landmark"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    instructions: text("instructions"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt,
});

export const adminUsers = pgTable(
  "admin_users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    roleId: integer("role_id").references(() => roles.id),
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    status: text("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    resetToken: text("reset_token"),
    resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex("admin_users_email_uq").on(t.email)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    adminId: integer("admin_id"),
    actorType: text("actor_type").notNull().default("admin"),
    actorName: text("actor_name"),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    summary: text("summary"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt,
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

/* ---------------------------------------------------------- settings/cms --- */

export type DayHours = {
  day: string;
  open: string;
  close: string;
  closed: boolean;
  special?: string;
};

export type DeliverySettings = {
  enabled: boolean;
  maxRadiusKm: number;
  baseFee: number;
  minOrderDelivery: number;
  minOrderPickup: number;
  freeDeliveryAbove: number;
  peakHourFee: number;
  peakStart: string;
  peakEnd: string;
  packagingFee: number;
  packagingPerItem: boolean;
  codEnabled: boolean;
  minOrderCod: number;
  maxOrderCod: number;
  contactlessEnabled: boolean;
  driverAssignEnabled: boolean;
};

export type TaxSettings = {
  gstEnabled: boolean;
  defaultRate: number;
  packagingTaxRate: number;
  deliveryTaxRate: number;
  pricesIncludeTax: boolean;
};

export type PaymentSettings = {
  onlineEnabled: boolean;
  upiEnabled: boolean;
  cardEnabled: boolean;
  netbankingEnabled: boolean;
  walletEnabled: boolean;
  codEnabled: boolean;
  payAtRestaurant: boolean;
  razorpayMode: string;
  upiId: string;
};

export type ReservationSettings = {
  enabled: boolean;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  maxPerSlot: number;
  minGuests: number;
  maxGuests: number;
  autoConfirm: boolean;
  blackoutDates: string;
  maxDaysAhead: number;
};

export type OrderingSettings = {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  schedulingEnabled: boolean;
  minLeadTimeMinutes: number;
  maxScheduleDays: number;
  cancellationWindowMinutes: number;
  allowCancelAfterPrep: boolean;
  tableQrEnabled: boolean;
  reviewsRequireApproval: boolean;
  quickAddEnabled: boolean;
  supportPhone: string;
};

export const restaurantSettings = pgTable("restaurant_settings", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull().default("Ravenous Multi Cuisine Restaurant"),
  shortName: text("short_name").notNull().default("Ravenous"),
  tagline: text("tagline").notNull().default("Multi Cuisine Restaurant"),
  brandMessage: text("brand_message")
    .notNull()
    .default("Good Food. Great Vibes. Made for Every Craving."),
  brandSubtext: text("brand_subtext")
    .notNull()
    .default(
      "Discover delicious multi-cuisine favourites, freshly prepared and delivered to your doorstep—or enjoy them at Ravenous.",
    ),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  addressLine: text("address_line").notNull().default("Ring Road No-2, Gaurav Path, Kalindi Kunj, Jarahbhata"),
  city: text("city").notNull().default("Bilaspur"),
  state: text("state").notNull().default("Chhattisgarh"),
  pincode: text("pincode").notNull().default("495001"),
  country: text("country").notNull().default("India"),
  phone: text("phone").notNull().default("093039 73399"),
  altPhone: text("alt_phone"),
  whatsapp: text("whatsapp").notNull().default("919303973399"),
  email: text("email").notNull().default("hello@ravenous.example"),
  mapsUrl: text("maps_url"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  priceRange: text("price_range").notNull().default("₹200–₹1,200 per person"),
  publicRating: text("public_rating").notNull().default("4.5"),
  publicReviewCount: integer("public_review_count").notNull().default(1129),
  services: text("services").notNull().default("Dine-in, Delivery, Drive-through"),
  shortDescription: text("short_description")
    .notNull()
    .default("A multi cuisine restaurant in Bilaspur serving Indian, Chinese and continental favourites."),
  aboutText: text("about_text")
    .notNull()
    .default(
      "Ravenous Multi Cuisine Restaurant brings together a wide variety of flavours in one welcoming destination in Bilaspur. From satisfying meals and biryanis to Chinese favourites, refreshing drinks and more, Ravenous is designed for every kind of craving.",
    ),
  aboutImageUrl: text("about_image_url"),
  heroImageUrl: text("hero_image_url"),
  galleryHeading: text("gallery_heading").notNull().default("Inside Ravenous"),
  gstNumber: text("gst_number"),
  fssaiNumber: text("fssai_number"),
  invoiceFooter: text("invoice_footer").notNull().default("Thank you for ordering from Ravenous."),
  status: text("status").notNull().default("open"),
  statusMessage: text("status_message"),
  busyExtraMinutes: integer("busy_extra_minutes").notNull().default(0),
  hours: jsonb("hours").$type<DayHours[]>(),
  weeklyHoliday: text("weekly_holiday"),
  social: jsonb("social").$type<Record<string, string>>(),
  delivery: jsonb("delivery").$type<Partial<DeliverySettings>>(),
  tax: jsonb("tax").$type<Partial<TaxSettings>>(),
  payment: jsonb("payment").$type<Partial<PaymentSettings>>(),
  reservation: jsonb("reservation").$type<Partial<ReservationSettings>>(),
  ordering: jsonb("ordering").$type<Partial<OrderingSettings>>(),
  updatedAt,
});

export const homepageSections = pgTable(
  "homepage_sections",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    body: text("body"),
    imageUrl: text("image_url"),
    ctaLabel: text("cta_label"),
    ctaHref: text("cta_href"),
    secondaryCtaLabel: text("secondary_cta_label"),
    secondaryCtaHref: text("secondary_cta_href"),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    updatedAt,
  },
  (t) => [uniqueIndex("homepage_sections_key_uq").on(t.key)],
);

export const legalPages = pgTable(
  "legal_pages",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    isPublished: boolean("is_published").notNull().default(true),
    updatedAt,
  },
  (t) => [uniqueIndex("legal_pages_slug_uq").on(t.slug)],
);

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  title: text("title"),
  category: text("category").notNull().default("food"),
  section: text("section"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  width: integer("width"),
  height: integer("height"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt,
});

/* ------------------------------------------------------------------ menu --- */

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    prepTimeMinutes: integer("prep_time_minutes").notNull().default(20),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug)],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    categoryId: integer("category_id").references(() => categories.id),
    cuisine: text("cuisine"),
    description: text("description"),
    shortDescription: text("short_description"),
    ingredients: text("ingredients"),
    allergens: text("allergens"),
    imageUrl: text("image_url"),
    gallery: jsonb("gallery").$type<string[]>().notNull().default([]),
    basePrice: money("base_price"),
    mrp: money("mrp"),
    taxRate: integer("tax_rate").notNull().default(5),
    foodType: text("food_type").notNull().default("veg"),
    isJain: boolean("is_jain").notNull().default(false),
    spiceLevel: text("spice_level").notNull().default("medium"),
    servingSize: text("serving_size").notNull().default("1 serving"),
    prepTimeMinutes: integer("prep_time_minutes").notNull().default(20),
    calories: integer("calories"),
    isAvailable: boolean("is_available").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    isBestseller: boolean("is_bestseller").notNull().default(false),
    isPopular: boolean("is_popular").notNull().default(false),
    isNew: boolean("is_new").notNull().default(false),
    isRecommended: boolean("is_recommended").notNull().default(false),
    hasCustomization: boolean("has_customization").notNull().default(false),
    tags: text("tags").notNull().default(""),
    availability: jsonb("availability")
      .$type<{ menuType?: string; startTime?: string; endTime?: string; days?: string[] } | null>(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    isDemoData: boolean("is_demo_data").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ratingAvg: integer("rating_avg").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("menu_items_slug_uq").on(t.slug),
    index("menu_items_category_idx").on(t.categoryId),
  ],
);

export const menuVariants = pgTable("menu_variants", {
  id: serial("id").primaryKey(),
  menuItemId: integer("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: money("price"),
  mrp: money("mrp"),
  stock: integer("stock").notNull().default(-1),
  prepTimeMinutes: integer("prep_time_minutes").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const addons = pgTable("addons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: money("price"),
  groupLabel: text("group_label").notNull().default("Extra"),
  appliesToCategoryId: integer("applies_to_category_id").references(() => categories.id),
  stock: integer("stock").notNull().default(-1),
  isAvailable: boolean("is_available").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt,
});

export const menuItemAddons = pgTable(
  "menu_item_addons",
  {
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    addonId: integer("addon_id")
      .notNull()
      .references(() => addons.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.menuItemId, t.addonId] })],
);

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("kg"),
  currentStock: integer("current_stock").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  costPerUnit: money("cost_per_unit"),
  supplier: text("supplier"),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt,
});

export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  menuItemId: integer("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
});

/* --------------------------------------------------------- order engine --- */

export const deliveryZones = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  minKm: integer("min_km").notNull().default(0),
  maxKm: integer("max_km").notNull().default(3),
  fee: money("fee"),
  minOrder: money("min_order"),
  extraPerKm: money("extra_per_km"),
  pincodes: text("pincodes").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const restaurantTables = pgTable(
  "restaurant_tables",
  {
    id: serial("id").primaryKey(),
    tableNumber: text("table_number").notNull(),
    code: text("code").notNull(),
    capacity: integer("capacity").notNull().default(4),
    section: text("section").notNull().default("Ground Floor"),
    status: text("status").notNull().default("available"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt,
  },
  (t) => [uniqueIndex("restaurant_tables_code_uq").on(t.code)],
);

export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    discountType: text("discount_type").notNull().default("percent"),
    discountValue: integer("discount_value").notNull().default(0),
    minOrder: money("min_order"),
    maxDiscount: money("max_discount"),
    appliesTo: text("applies_to").notNull().default("all"),
    categoryId: integer("category_id").references(() => categories.id),
    menuItemId: integer("menu_item_id").references(() => menuItems.id),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    usageLimit: integer("usage_limit").notNull().default(0),
    perUserLimit: integer("per_user_limit").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    firstOrderOnly: boolean("first_order_only").notNull().default(false),
    daysOfWeek: text("days_of_week").notNull().default(""),
    startTime: text("start_time"),
    endTime: text("end_time"),
    orderTypes: text("order_types").notNull().default("delivery,pickup,dinein"),
    isActive: boolean("is_active").notNull().default(true),
    isDemoData: boolean("is_demo_data").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex("coupons_code_uq").on(t.code)],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderCode: text("order_code").notNull(),
    userId: integer("user_id").references(() => users.id),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    orderType: text("order_type").notNull().default("delivery"),
    status: text("status").notNull().default("placed"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    paymentMethod: text("payment_method").notNull().default("cash"),
    paymentReference: text("payment_reference"),
    addressId: integer("address_id"),
    addressSnapshot: jsonb("address_snapshot").$type<Record<string, unknown>>(),
    latitude: text("latitude"),
    longitude: text("longitude"),
    distanceKm: integer("distance_km").notNull().default(0),
    deliveryFee: money("delivery_fee"),
    packagingFee: money("packaging_fee"),
    subtotal: money("subtotal"),
    discountTotal: money("discount_total"),
    taxTotal: money("tax_total"),
    deliveryTax: money("delivery_tax"),
    couponCode: text("coupon_code"),
    couponId: integer("coupon_id"),
    total: money("total"),
    itemCount: integer("item_count").notNull().default(0),
    customerNote: text("customer_note"),
    adminNote: text("admin_note"),
    tableId: integer("table_id"),
    tableCode: text("table_code"),
    driverId: integer("driver_id"),
    driverName: text("driver_name"),
    prepTimeMinutes: integer("prep_time_minutes").notNull().default(25),
    etaMinutes: integer("eta_minutes").notNull().default(40),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    contactless: boolean("contactless").notNull().default(false),
    cancellationReason: text("cancellation_reason"),
    cancelledBy: text("cancelled_by"),
    rejectionReason: text("rejection_reason"),
    refundStatus: text("refund_status"),
    codCollected: boolean("cod_collected").notNull().default(false),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    isDemoData: boolean("is_demo_data").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("orders_code_uq").on(t.orderCode),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: integer("menu_item_id"),
    variantId: integer("variant_id"),
    name: text("name").notNull(),
    variantName: text("variant_name"),
    foodType: text("food_type").notNull().default("veg"),
    unitPrice: money("unit_price"),
    mrp: money("mrp"),
    quantity: integer("quantity").notNull().default(1),
    addonsTotal: money("addons_total"),
    lineDiscount: money("line_discount"),
    taxRate: integer("tax_rate").notNull().default(5),
    taxAmount: money("tax_amount"),
    lineTotal: money("line_total"),
    notes: text("notes"),
    createdAt,
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderItemAddons = pgTable("order_item_addons", {
  id: serial("id").primaryKey(),
  orderItemId: integer("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  addonId: integer("addon_id"),
  name: text("name").notNull(),
  price: money("price"),
  quantity: integer("quantity").notNull().default(1),
});

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note"),
    actorType: text("actor_type").notNull().default("system"),
    actorId: integer("actor_id"),
    createdAt,
  },
  (t) => [index("order_history_order_idx").on(t.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("cash"),
    method: text("method").notNull().default("cash"),
    amount: money("amount"),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("initiated"),
    gatewayOrderId: text("gateway_order_id"),
    gatewayPaymentId: text("gateway_payment_id"),
    gatewaySignature: text("gateway_signature"),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
    failureReason: text("failure_reason"),
    confirmedByAdminId: integer("confirmed_by_admin_id"),
    createdAt,
    updatedAt,
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

export const refunds = pgTable("refunds", {
  id: serial("id").primaryKey(),
  refundCode: text("refund_code").notNull(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  paymentId: integer("payment_id"),
  userId: integer("user_id"),
  amount: money("amount"),
  reason: text("reason"),
  method: text("method").notNull().default("original"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  processedByAdminId: integer("processed_by_admin_id"),
  createdAt,
  updatedAt,
});

export const couponRedemptions = pgTable("coupon_redemptions", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id").notNull(),
  userId: integer("user_id"),
  orderId: integer("order_id").notNull(),
  discountAmount: money("discount_amount"),
  createdAt,
});

export const deliveryAssignments = pgTable("delivery_assignments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  driverId: integer("driver_id").notNull(),
  assignedByAdminId: integer("assigned_by_admin_id"),
  status: text("status").notNull().default("assigned"),
  notes: text("notes"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});

/* -------------------------------------------------------- guests/social --- */

export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  date: text("date").notNull(),
  time: text("time").notNull(),
  guests: integer("guests").notNull().default(2),
  specialRequest: text("special_request"),
  status: text("status").notNull().default("requested"),
  tableId: integer("table_id"),
  adminNote: text("admin_note"),
  createdAt,
  updatedAt,
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  menuItemId: integer("menu_item_id"),
  orderId: integer("order_id"),
  userId: integer("user_id"),
  customerName: text("customer_name").notNull(),
  rating: integer("rating").notNull().default(5),
  title: text("title"),
  comment: text("comment"),
  photos: jsonb("photos").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("pending"),
  adminResponse: text("admin_response"),
  isVerified: boolean("is_verified").notNull().default(false),
  isDemoData: boolean("is_demo_data").notNull().default(false),
  createdAt,
});

export const favorites = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    createdAt,
  },
  (t) => [uniqueIndex("favorites_uq").on(t.userId, t.menuItemId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    audience: text("audience").notNull().default("customer"),
    userId: integer("user_id"),
    orderId: integer("order_id"),
    type: text("type").notNull().default("info"),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt,
  },
  (t) => [index("notifications_audience_idx").on(t.audience, t.isRead)],
);

export const notificationLogs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull().default("email"),
  recipient: text("recipient").notNull(),
  template: text("template").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  status: text("status").notNull().default("queued"),
  error: text("error"),
  createdAt,
});

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  orderId: integer("order_id"),
  userId: integer("user_id"),
  name: text("name").notNull(),
  phone: text("phone"),
  category: text("category").notNull().default("other"),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("open"),
  assignedAdminId: integer("assigned_admin_id"),
  resolutionNotes: text("resolution_notes"),
  createdAt,
  updatedAt,
});

export type User = typeof users.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type RestaurantSettings = typeof restaurantSettings.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type MenuVariant = typeof menuVariants.$inferSelect;
export type Addon = typeof addons.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderItemAddon = typeof orderItemAddons.$inferSelect;
export type OrderStatusRow = typeof orderStatusHistory.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type TableRow = typeof restaurantTables.$inferSelect;
export type MediaRow = typeof media.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type HomepageSection = typeof homepageSections.$inferSelect;
export type LegalPage = typeof legalPages.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type RoleRow = typeof roles.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
