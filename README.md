# GearUp API 🏋️

Backend REST API for **GearUp** — a sports & outdoor gear rental platform. Built with **Express + TypeScript + Prisma (PostgreSQL) + JWT + Zod + Stripe**, using a modular (feature-folder) architecture.

## Tech Stack

- **Runtime:** Node.js, Express 4, TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT (access + refresh tokens), bcrypt password hashing, role-based access control
- **Validation:** Zod (body/query/params schemas on every mutating route)
- **Payments:** Stripe Checkout Sessions + webhook; SSLCommerz scaffolded as a second gateway
- **Uploads:** Multer (local disk in dev; swappable for S3/Cloudinary)
- **Security:** Helmet, CORS allow-list, centralized error handler, Prisma-error mapping

## Architecture

```
src/
  app.ts                # express app assembly (middleware, routes)
  server.ts              # entrypoint: db connect + listen + graceful shutdown
  config/                 # env, prisma client, stripe client
  middleware/              # auth, role guard, zod validate, error handler
  routes/index.ts           # mounts every module's router under /api
  modules/
    auth/                    # register, login, refresh, me
    user/                     # profile update, change password
    gear/                      # public browse/search/filter + details
    category/                   # public list + admin CRUD
    provider/                    # provider gear CRUD + incoming orders
    rental/                       # customer: create/list/cancel rental orders
    payment/                       # Stripe + SSLCommerz initiate/confirm/webhook
    review/                         # post-return reviews
    admin/                           # users, gear, rentals moderation + stats
    upload/                          # image upload
  each module = *.routes.ts, *.controller.ts, *.service.ts, *.validation.ts
prisma/
  schema.prisma            # full data model
```

Each module follows **routes → controller → service → Prisma**, so business logic stays out of controllers and is easy to unit test.

## Getting Started

```bash
cp .env.example .env        # fill in DATABASE_URL, JWT secrets, Stripe keys
npm install
npm run prisma:migrate      # creates tables from schema.prisma
npm run dev                 # http://localhost:5000
```

### Stripe webhook (local testing)
```bash
stripe listen --forward-to localhost:5000/api/payments/webhook/stripe
```
Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

## Rental order lifecycle

```
PLACED → CONFIRMED (provider) → PAID (Stripe/SSLCommerz) → PICKED_UP (provider) → RETURNED (provider)
   ↘ CANCELLED (customer, while PLACED/CONFIRMED)
```
Cancelling or returning an order automatically restores `availableStock` on the gear item. Reviews can only be created once an order reaches `RETURNED`.

## API Overview

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <accessToken>`.

**Auth** — `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
**Users** — `PUT /users/me`, `PUT /users/me/password`
**Gear (public)** — `GET /gear`, `GET /gear/:id`
**Categories** — `GET /categories` (public), `POST/PUT/DELETE /categories` (admin)
**Rentals (customer)** — `POST /rentals`, `GET /rentals`, `GET /rentals/:id`, `PATCH /rentals/:id/cancel`
**Payments** — `POST /payments/create`, `POST /payments/confirm`, `GET /payments`, `GET /payments/:id`, webhook at `POST /payments/webhook/stripe`
**Provider** — `GET /provider/dashboard`, `POST/GET/PUT/DELETE /provider/gear`, `GET /provider/orders`, `PATCH /provider/orders/:id`
**Reviews** — `POST /reviews`
**Admin** — `GET /admin/dashboard`, `GET/PATCH /admin/users`, `GET/PATCH /admin/gear`, `GET /admin/rentals`
**Uploads** — `POST /uploads` (multipart, field name `images`)

Every list endpoint supports `page` & `limit` query params and returns `{ success, message, meta, data }`.

## Notes for production

- Swap the local-disk upload storage for S3/Cloudinary.
- Rotate JWT secrets and set `NODE_ENV=production` (env vars become required, not silently defaulted).
- Fill in real SSLCommerz store credentials and replace the scaffolded redirect URL in `payment.service.ts` with a real session-init call.
