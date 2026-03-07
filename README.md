# fastify-short-url

A high-performance, dynamic Short URL system built for lightweight LXC containers on Proxmox. Designed for extreme resource efficiency using Bun, Fastify, Drizzle ORM, and an optional Redis cache layer.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Framework | [Fastify v5](https://fastify.dev) |
| Language | TypeScript (strict) |
| Database | MySQL 8+ |
| ORM | [Drizzle ORM](https://orm.drizzle.team) |
| Cache | Redis 7+ *(optional — see below)* |
| Frontend | EJS + [HTMX](https://htmx.org) + [Tailwind CSS](https://tailwindcss.com) |
| Auth | `@fastify/jwt` + `@fastify/cookie` (HttpOnly JWT cookie) |
| QR Code | [qrcode](https://github.com/soldair/node-qrcode) |

---

## Project Structure

```
fastify-short-url/
├── .env.example              # Copy to .env and fill in values
├── drizzle.config.ts         # Drizzle Kit configuration
├── package.json
├── tsconfig.json
└── src/
    ├── server.ts             # Entry point — plugin registration order
    ├── db/
    │   ├── connection.ts     # MySQL pool factory
    │   ├── schema.ts         # Drizzle schema (admins, urls, clicks, settings)
    │   └── seed.ts           # Default admin + settings seed
    ├── plugins/
    │   ├── db.ts             # fastify.decorate('db', ...) via mysql2 pool
    │   ├── redis.ts          # fastify.decorate('redis', ...) — real or no-op driver
    │   ├── auth.ts           # JWT + Cookie + authenticate preHandler decorator
    │   ├── view.ts           # @fastify/view (EJS engine)
    │   ├── settings.ts       # fastify.decorate('getSettings', ...) with Redis cache
    │   └── maintenance.ts    # onRequest hook — blocks all non-admin traffic when enabled
    ├── modules/
    │   ├── auth/routes.ts    # GET/POST /auth/login, POST /auth/logout
    │   ├── url/routes.ts     # GET /:code (redirect) + admin CRUD + QR
    │   ├── analytics/routes.ts  # /admin/analytics summary + per-URL detail + reset
    │   ├── settings/routes.ts   # GET/PATCH /admin/settings/:key
    │   └── admin/routes.ts   # /admin/dashboard shell
    └── views/
        ├── layouts/main.ejs
        ├── auth/
        │   ├── login.ejs
        │   └── partials/login-error.ejs
        ├── admin/
        │   ├── dashboard.ejs
        │   └── partials/
        │       ├── url-table.ejs
        │       ├── analytics.ejs
        │       ├── analytics-detail.ejs
        │       ├── settings.ejs
        │       ├── setting-row.ejs
        │       ├── qr-modal.ejs
        │       └── form-error.ejs
        └── errors/
            ├── 404.ejs
            ├── expired.ejs
            ├── maintenance.ejs
            └── error.ejs
```

---

## Prerequisites

- [Bun](https://bun.sh) >= 1.1
- MySQL 8.0+
- Redis 7+ *(optional — set `REDIS_ENABLED=false` to skip)*

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/your-org/fastify-short-url.git
cd fastify-short-url
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values. Minimum required fields:

```env
DB_HOST=127.0.0.1
DB_USER=shorturl
DB_PASSWORD=your_password
DB_NAME=shorturl

JWT_SECRET=<run: openssl rand -hex 64>
COOKIE_SECRET=<run: openssl rand -hex 64>
```

### 3. Set Up the Database

```bash
# Push the Drizzle schema to your MySQL database
bun run db:push

# Seed default admin user (admin / admin123) and default settings
bun run db:seed
```

> **Important:** Change the admin password immediately after first login.

### 4. Run

```bash
# Development (hot reload)
bun run dev

# Production
bun run start
```

---

## Available Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start with hot reload (`--hot`) |
| `bun run start` | Start in production mode |
| `bun run build` | Compile to a single Bun binary in `dist/` |
| `bun run typecheck` | Run TypeScript type checking (no emit) |
| `bun run db:generate` | Generate Drizzle migration files |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:push` | Push schema directly to DB (no migration files) |
| `bun run db:studio` | Open Drizzle Studio (visual DB browser) |
| `bun run db:seed` | Seed initial admin + default settings |

### Building for Production

```bash
bun run build
# Outputs: dist/server.js

# Run the compiled artifact
bun dist/server.js
```

---

## Redis Configuration

Redis is **optional**. When disabled, all caching is replaced with a no-op driver — the application functions correctly, but every shortlink redirect queries MySQL directly.

| `REDIS_ENABLED` | Behaviour |
|---|---|
| `true` (default) | Connect to Redis. **Fails fast on startup** if Redis is unreachable. |
| `false` | Skip Redis entirely. Uses no-op `CacheClient`. No cache errors. |

To run without Redis:

```env
REDIS_ENABLED=false
```

When Redis is enabled and the shortlink is in cache, the redirect response time is typically **< 1ms** (cache-hit path does not touch MySQL at all).

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` or `production` |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3000` | HTTP port |
| `BASE_URL` | `http://localhost:3000` | Public base URL (used in QR codes & short URLs) |
| `DB_HOST` | `127.0.0.1` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | *(empty)* | MySQL password |
| `DB_NAME` | `shorturl` | MySQL database name |
| `REDIS_ENABLED` | `true` | Set `false` to disable Redis entirely |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | *(empty)* | Redis `AUTH` password |
| `REDIS_TTL` | `3600` | Shortlink cache TTL in seconds |
| `JWT_SECRET` | *(required)* | JWT signing secret — minimum 64 chars |
| `COOKIE_SECRET` | *(required)* | Cookie signing secret — minimum 64 chars |

---

## Database Schema

```
admins    — Admin accounts (username + Argon2id password hash)
urls      — Shortlinks (shortcode, originalUrl, isActive, expiresAt, totalClicks)
clicks    — Click events (urlId FK, hashed IP, userAgent, referer, timestamp)
settings  — Dynamic key/value site configuration
```

IP addresses are stored as **SHA-256 hashes** — raw IPs are never persisted (GDPR-friendly).

### Default Settings (seeded)

| Key | Type | Default | Description |
|---|---|---|---|
| `app_name` | string | `ShortURL` | Public name of the service |
| `default_expiry_days` | number | `0` | Default link lifetime in days (0 = never) |
| `maintenance_mode` | boolean | `false` | Blocks all redirects with HTTP 503 |
| `allow_custom_alias` | boolean | `true` | Allow admins to set custom shortcodes |
| `max_alias_length` | number | `32` | Max character length for custom aliases |

---

## Architecture

### Plugin Registration Order (`server.ts`)

```
db → redis → sensible → formbody → auth (JWT+Cookie) → view (EJS) → settings → maintenance → routes
```

All Fastify plugins use `fastify-plugin` (`fp`) and `fastify.decorate()` — **no global variables** anywhere in the codebase.

### Redirect Flow (cache-first)

```
GET /:code
  │
  ├─ Redis HIT  ──→ 301 redirect  (async click logged via setImmediate)
  │
  └─ Redis MISS ──→ MySQL lookup
       │
       ├─ Found & active ──→ populate Redis → 301 redirect (async click logged)
       │
       └─ Not found / inactive / expired ──→ 404 / 410
```

Click analytics are recorded **asynchronously** via `setImmediate()` so they never block the redirect response.

### Route Protection

All `/admin/*` routes use the `authenticate` preHandler decorator:

```typescript
const adminOpts = { preHandler: [app.authenticate] };
app.get('/admin/urls', adminOpts, handler);
```

`authenticate` verifies the JWT from the `token` HttpOnly cookie. HTMX requests receive `HX-Redirect: /auth/login` on 401 so only the tab navigates — no full page reload.

---

## HTMX Integration

The admin dashboard is a single-page shell (`dashboard.ejs`) that uses HTMX to swap content panels without any JavaScript framework.

### Login

```html
<form hx-post="/auth/login" hx-target="#login-error" hx-swap="innerHTML">
```

- **401 (wrong credentials)**: Server returns an HTML `<p>` error partial → swapped into `#login-error`
- **200 (success)**: Server sets `HttpOnly token` cookie → replies `HX-Redirect: /admin/dashboard` → HTMX navigates

### Toggle Maintenance Mode

```html
<input type="checkbox"
  hx-patch="/admin/settings/maintenance_mode"
  hx-vals='js:{value: event.target.checked ? "true" : "false"}'
  hx-target="closest tr"
  hx-swap="outerHTML" />
```

1. HTMX sends `PATCH /admin/settings/maintenance_mode` with `{value: "true"|"false"}`
2. JWT cookie is sent automatically (same-origin)
3. Server validates JWT → updates DB → **invalidates Redis settings cache**
4. Returns the re-rendered `<tr>` partial → HTMX swaps only that single row

Zero JS bundle. Zero full page reload.

---

## Security Notes

| Concern | Implementation |
|---|---|
| Password storage | Argon2id via `Bun.password.hash/verify` |
| Session | Stateless JWT in `HttpOnly; SameSite=Lax; Secure (prod)` cookie |
| IP logging | SHA-256 hashed — raw IP never stored |
| Custom aliases | Validated against `/^[a-zA-Z0-9_-]+$/` before insert |
| CSRF | SameSite=Lax cookie + HTMX same-origin requests |
| Secrets | All secrets from environment variables — never hardcoded |
| Duplicate alias | MySQL unique constraint + application-level duplicate error message |

> Generate secure secrets:
> ```bash
> openssl rand -hex 64   # for JWT_SECRET
> openssl rand -hex 64   # for COOKIE_SECRET
> ```

---

## Deployment on LXC / Proxmox

```bash
# 1. Build a single binary
bun run build

# 2. Copy dist/server.js + .env to the container
# 3. Start

bun dist/server.js
```

**Recommended container resources:**

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 1 vCPU | 2 vCPUs |
| RAM | 128 MB | 256 MB (512 MB with Redis co-located) |
| Disk | 256 MB | 512 MB |

For maximum redirect performance, run Redis on the **same LXC container** and set `REDIS_HOST=127.0.0.1`.

---
