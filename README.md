# Ravenous Multi Cuisine Restaurant — ordering & management platform

A complete, production-shaped restaurant operating system for **Ravenous Multi Cuisine Restaurant**
(Ring Road No-2, Gaurav Path, Kalindi Kunj, Jarahbhata, Bilaspur, Chhattisgarh 495001 · 093039 73399).

Customer website + online ordering + kitchen display + restaurant admin, all backed by PostgreSQL and Drizzle ORM.

## 1. Stack

- **Next.js (App Router, TypeScript)** — server components for SEO pages, client components for interactive ordering/admin
- **PostgreSQL + Drizzle ORM** — 30+ relational tables, foreign keys, indexes, order snapshots
- **Tailwind CSS v4** — premium restaurant theme, dark cinematic sections, cream surfaces
- **Three.js (dynamic import)** — lightweight WebGL hero with static fallback for mobile/low-power/reduced-motion
- **bcryptjs + jose** — password hashing and signed HTTP-only session cookies
- **zod** — server-side input validation on every mutating endpoint
- **qrcode** — per-table dine-in QR codes

## 2. Setup

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL, AUTH_SECRET, optional gateway/mail keys
npx drizzle-kit push          # create tables
npx tsx src/db/seed-run.ts     # demo data + roles + admin users  (add --force to reset)
npm run dev                    # http://localhost:3000
```

Production: `npm run build && npm run start`. The `/api/health` endpoint verifies the database and self-seeds an empty
database on first boot.

### Seeded logins (change after first sign-in)

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | admin@ravenous.local | Admin@12345 |
| Manager | manager@ravenous.local | Manager@12345 |
| Kitchen staff | staff@ravenous.local | Staff@12345 |
| Delivery staff | driver@ravenous.local | Driver@12345 |
| Customer (demo) | customer@ravenous.local | Customer@12345 |

All menu items, offers and reviews created by the seed are marked **DEMO DATA** in the UI and can be replaced from
the admin dashboard.

## 3. Feature map

**Customer** — home (3D hero, search, categories, popular dishes, offers, story, gallery, reviews, location, CTA),
menu with filters/sorting/pagination, dish detail with variants + add-ons + spice + preferences + special
instructions, cart (save for later, coupons), multi-step checkout (delivery / pickup / dine-in / table QR),
online payment or COD / pay-at-restaurant, order confirmation, live order tracking (SSE + polling), invoices
(print → PDF), reorder, reviews, favourites, saved addresses with “use current location”, reservations, support
tickets, notifications, FAQ and editable legal pages.

**Restaurant** — dashboard KPIs and quick actions, live orders with accept/reject/assign/progress, kitchen display
system with timers and delay warnings, menu/variant/add-on/category management, availability toggles, inventory with
low-stock alerts, customers, reservations, tables + QR generation, delivery zones and fees, payments & refunds,
offers/coupons (percentage, fixed, free delivery, first-order, happy hours), reviews moderation, media library with
uploads, homepage CMS, legal pages, reports & analytics with CSV exports, admin users, roles & permissions, audit
logs.

## 4. Server-side integrity rules

- **All money is stored as integer paise** — no floating point drift.
- **Totals are recalculated on the server** for every cart quote and order (`src/lib/pricing.ts`); the browser only
  displays them.
- **Historical price rule** — order items snapshot name, variant, add-ons, unit price, discount and tax at purchase
  time, so later menu price changes never alter old orders.
- **Delivery fee is charged once per order** using distance slabs from the restaurant's configured coordinates
  (haversine) with a pincode fallback table for Bilaspur.
- **Payments** are only marked paid from a verified Razorpay signature, a signed webhook, or an explicit
  staff confirmation; refunds stay *pending* until completion is confirmed.
- **Authorization** is enforced on the server (`requireUser`, `requireAdmin(permission)`) for every customer and
  admin endpoint; permission keys such as `orders.manage`, `menu.edit`, `settings.manage` are editable per role.
- **Rate limiting** covers login, register, password reset, coupon checks, order creation, payments, reviews and
  support forms.
- **Audit log** records admin sign-ins, menu and price changes, order accept/reject, payment confirmations, refunds,
  settings changes, uploads and role/permission edits.

## 5. API documentation (selected)

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/api/health` | DB + seed status |
| GET/POST | `/api/auth` | `GET` session; `POST` `register`/`login`/`logout`/`forgot`/`reset`/`update-profile`/`change-password` |
| GET | `/api/settings` | Public restaurant config, hours, delivery, payment flags |
| GET | `/api/menu` | `q`, `category`, `foodType`, `minPrice`, `maxPrice`, `spicy`, `bestseller`, `popular`, `new`, `sort`, `page` |
| GET | `/api/menu/[slug]` | Dish detail + related items + reviews |
| POST | `/api/cart` | `action: quote | coupon` — server-priced cart |
| GET/POST | `/api/addresses` | `PUT` update, `DELETE ?id=` |
| GET/POST | `/api/orders` | List (own orders) / create (server recalculates everything) |
| GET/PATCH | `/api/orders/[id]` | Detail; `cancel`, `request-bill`, `reorder`, admin `status` |
| POST | `/api/payments` | `create` gateway order, `verify` signature, `failure` |
| POST | `/api/payments/webhook` | Razorpay webhook (HMAC verified) |
| GET/POST | `/api/geo` | Geocode (OSM + Bilaspur fallback) and distance/delivery quote |
| GET/POST/PATCH | `/api/reviews` `/api/favorites` `/api/reservations` `/api/notifications` `/api/support` | customer self-service |
| GET | `/api/tables/[code]` | Table QR dine-in menu + table info |
| GET | `/api/stream` | SSE: `?orderId=` customer tracking, otherwise admin live feed |
| POST | `/api/admin/auth` | Admin login/logout/change-password |
| GET | `/api/admin/dashboard` | KPI counts, low stock, notifications, recent orders |
| GET/PATCH | `/api/admin/orders/[id]` | Detail; status, note, assign-driver, confirm-payment, collect-cod, refund, refund-complete |
| GET/POST/PUT/PATCH/DELETE | `/api/admin/resource/[resource]` | Generic CRUD for categories, menu-items, variants, addons, inventory, coupons, delivery-zones, tables, reservations, customers, reviews, refunds, media, homepage, legal-pages, admins, roles, support-tickets, notifications |
| GET/PATCH | `/api/admin/settings` | Restaurant settings, hours, delivery/tax/payment/reservation/ordering groups |
| GET | `/api/admin/reports` | Sales, dishes, categories, order types, payments, peak hours, KPIs |
| GET | `/api/admin/export` | CSV: `orders`, `customers`, `menu`, `inventory`, `refunds`, `reservations` |
| POST | `/api/admin/upload` | Image upload (MIME/extension/size validated) |
| GET | `/api/admin/qr` | Table QR SVG |

## 6. Operations

**Backups** — `pg_dump "$DATABASE_URL" > ravenous-$(date +%F).sql` (schedule daily), plus
`tar czf media-$(date +%F).tar.gz public/uploads` for uploaded images. Restore with
`psql "$DATABASE_URL" < ravenous-YYYY-MM-DD.sql`. Keep `.env` in a secure secret manager; after restoring, run
`npx drizzle-kit push` to apply any newer schema.

**Configuration** — payments: set `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` (+ `RAZORPAY_WEBHOOK_SECRET`, webhook URL
`/api/payments/webhook`). Email: `EMAIL_API_KEY`/`EMAIL_FROM`/`ADMIN_EMAIL`. Storage: `STORAGE_API_KEY`/`STORAGE_BUCKET`
(local uploads used when unset). Maps: `MAPS_API_KEY` (an offline Bilaspur locality table keeps distance quotes
working without it).

**Troubleshooting** — empty menu → run the seed or add dishes in admin; payments stuck pending → gateway keys or
webhook not configured; delivery always “outside area” → set latitude/longitude in Restaurant Settings; orders
blocked → check the restaurant status banner (Open / Busy / Delivery paused).
