# fastify-short-url

A high-performance, feature-complete URL shortener built for lightweight LXC containers on Proxmox. Designed for extreme resource efficiency using Bun, Fastify, Drizzle ORM, and an optional Redis cache layer.

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
| Frontend | EJS + [HTMX](https://htmx.org) + [Tailwind CSS CDN](https://tailwindcss.com) |
| Auth | `@fastify/jwt` + `@fastify/cookie` (HttpOnly JWT cookie) |
| Env Config | `@fastify/env` (structured validation + `app.config` accessor) |
| QR Code | [qrcode](https://github.com/soldair/node-qrcode) |

---

## Features

- **Shortlink management** — create, edit, delete, toggle active/inactive
- **Custom aliases** — user-defined shortcodes with validation
- **Password-protected links** — Argon2id-verified access gate per link
- **SEO metadata per link** — title, description, Open Graph image URL
- **Social bot preview** — returns an OG preview page for crawlers; direct visitors get 301 redirect
- **QR code generation** — downloadable QR per shortlink
- **Click analytics** — total + unique clicks, clicks-per-day chart (30 days), per-click history with IP, device, browser, OS
- **Client-side UA parsing** — device/browser/OS detected in the browser (no server overhead)
- **Activity logs** — full audit trail of all admin actions with IP, user, timestamp, description
- **Multi-admin** — superadmin + admin roles; superadmin manages users
- **Pagination, search, sort** — all tables support server-side pagination with per-page selector (default 10), column sorting, and search
- **Sitemap & robots.txt** — dynamic `/sitemap.xml` (active shortlinks) and `/robots.txt` served at root
- **Maintenance mode** — one-setting toggle blocks all public redirects with 503
- **Redis caching** — optional; disable with `REDIS_ENABLED=false` for zero-dependency deployments

---

## Project Structure

```
fastify-short-url/
├── .env.example              # Copy to .env and fill in values
├── build.ts                  # Production build script (Bun.build + asset copy)
├── drizzle.config.ts         # Drizzle Kit configuration
├── package.json
├── tsconfig.json
├── drizzle/                  # Auto-generated migration files
└── src/
    ├── server.ts             # Entry point — plugin/route registration + robots.txt/sitemap
    ├── db/
    │   ├── connection.ts     # MySQL pool factory
    │   ├── schema.ts         # Barrel re-export of all schemas
    │   ├── schemas/
    │   │   ├── admins.ts     # admins table
    │   │   ├── urls.ts       # urls table (shortcode, SEO fields, password)
    │   │   ├── clicks.ts     # clicks table (raw IP, user-agent, referer)
    │   │   ├── settings.ts   # key/value settings table
    │   │   ├── activity_logs.ts  # admin activity audit log
    │   │   └── index.ts
    │   └── seed.ts           # Default admin + settings seed
    ├── types/                # Shared DTO types
    ├── plugins/
    │   ├── env.ts            # @fastify/env — validates .env, exposes app.config
    │   ├── db.ts             # MySQL2 pool → app.db
    │   ├── redis.ts          # Real Redis or no-op CacheClient → app.redis
    │   ├── auth.ts           # JWT + Cookie + authenticate preHandler
    │   ├── view.ts           # @fastify/view (EJS) with auto-layout logic
    │   ├── settings.ts       # app.getSettings() with Redis cache (30-day TTL)
    │   ├── static.ts         # @fastify/static — /assets/ with 7-day cache in prod
    │   └── maintenance.ts    # onRequest hook — 503 when maintenance_mode=true
    ├── modules/
    │   ├── auth/             # GET/POST /login, POST /logout
    │   ├── url/              # GET /:code (redirect+bot preview) + admin CRUD
    │   ├── analytics/        # DELETE /admin/analytics/:id/reset
    │   ├── settings/         # PATCH /admin/settings/:key
    │   ├── users/            # GET/POST/DELETE /admin/users (superadmin only)
    │   ├── logs/             # GET /admin/logs (activity log viewer)
    │   ├── profile/          # GET /admin/profile, PATCH /admin/profile/password
    │   └── admin/            # Tab page handlers (links, analytics, users, settings)
    └── views/
        ├── layouts/main.ejs      # Base layout (favicon, theme-color, SEO defaults)
        ├── auth/login.ejs        # Login page (noindex)
        ├── url/
        │   ├── preview.ejs       # OG preview for social bots
        │   └── password.ejs      # Password-gate page (noindex)
        ├── admin/
        │   ├── dashboard.ejs     # SPA shell (noindex) — navbar, tabs, panel, modals
        │   └── partials/         # HTMX-swapped tab panels + create/edit/qr modals
        └── errors/               # 404, 410, 5xx, maintenance (all noindex)
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

Edit `.env` — minimum required fields:

```env
BASE_URL=https://your-domain.com

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

> **Important:** Change the admin password immediately after first login via the **Profil** tab.

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
| `bun run build` | Bundle + copy assets to `dist/` |
| `bun run typecheck` | Run TypeScript type checking (no emit) |
| `bun run db:generate` | Generate Drizzle migration files |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:push` | Push schema directly to DB (no migration files) |
| `bun run db:studio` | Open Drizzle Studio (visual DB browser) |
| `bun run db:seed` | Seed initial admin + default settings |

### Building for Production

```bash
bun run build
# Output:
#   dist/server.js         — minified bundle
#   dist/server.js.map     — source map
#   dist/**/*.ejs          — view templates
#   dist/public/           — static assets (CSS, JS, favicon, images)

NODE_ENV=production bun dist/server.js
```

---

## Redis Configuration

Redis is **optional**. When disabled, all caching is replaced with a no-op driver.

| `REDIS_ENABLED` | Behaviour |
|---|---|
| `true` | Connect to Redis. Fails fast on startup if Redis is unreachable. |
| `false` | Skip Redis entirely. Uses no-op `CacheClient`. No cache errors. |

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` or `production` |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3000` | HTTP port |
| `BASE_URL` | `http://localhost:3000` | Public base URL (used in QR codes, short URLs, sitemap) |
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
admins         — Admin accounts (username, Argon2id password hash, role)
urls           — Shortlinks (shortcode, originalUrl, isActive, expiresAt, totalClicks,
                             passwordHash, title, description, ogImageUrl)
clicks         — Click events (urlId FK, raw IP address, userAgent, referer, timestamp)
settings       — Dynamic key/value site configuration
activity_logs  — Admin audit trail (adminId FK, action, description, ipAddress, timestamp)
```

IP addresses are stored **as-is** (raw) in the `ip_address` column (max 45 chars, supports IPv6).

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
env → db → redis → sensible → formbody → auth → view → static → settings → maintenance
  → routes (auth, url, analytics, settings, users, admin+logs, profile)
  → /robots.txt + /sitemap.xml handlers
  → error handler + 404 handler
```

### Redirect Flow (cache-first)

```
GET /:code
  │
  ├─ Social bot? ──────────→ MySQL (bypass cache) → OG preview page (if SEO data)
  │
  ├─ Redis HIT  ───────────→ 301 redirect (async click log via setImmediate)
  │
  └─ Redis MISS ───────────→ MySQL lookup
       ├─ active + no password ──→ populate Redis → 301 redirect (async click log)
       ├─ password required ─────→ password gate page
       ├─ expired ───────────────→ 410
       └─ not found / inactive ──→ 404
```

Click analytics are recorded **asynchronously** via `setImmediate()` so they never block the redirect response.

### Admin Dashboard (HTMX SPA)

`dashboard.ejs` is a single-page shell that swaps content panels via HTMX. Tab clicks do:

```html
hx-get="/admin/links"
hx-target="#panel"
hx-swap="innerHTML"
hx-push-url="true"
```

On direct URL access the server wraps the same partial in the full shell. Sort/filter/pagination forms submit via HTMX and replace only the relevant section (`#url-list`, `#users-section`, `#logs-list`).

Sort icons are rendered **client-side** by `url-table.js` — the server only returns the active sort field/direction in a hidden `<input>`, eliminating EJS scriptlet computation on every request.

### User-Agent Parsing (Client-side)

The analytics click history table includes Device, Browser, and OS columns. These are parsed in the browser by `parseUA()` in `url-table.js` from the `data-ua` attribute on each row. No server-side UA library required.

### SEO & Crawlers

- All admin, auth, and error pages have `<meta name="robots" content="noindex, nofollow">`.
- Shortlinks served to social media bots (detected by User-Agent) return a full OG preview page with title, description, og:image, and a meta-refresh fallback.
- `/sitemap.xml` — dynamically generated from all active, non-expired shortlinks (up to 5000). Cached for 1 hour.
- `/robots.txt` — disallows `/admin/`, `/login`, `/logout`. Cached for 24 hours.
- All pages include `<link rel="icon" href="/assets/favicon.ico">` and `<meta name="theme-color">`.

### Admin Roles

| Role | Capabilities |
|---|---|
| `superadmin` | Full access — users, settings, links, analytics, logs |
| `admin` | Links, analytics, settings, logs, own profile |

---

## Security Notes

| Concern | Implementation |
|---|---|
| Password storage | Argon2id via `Bun.password.hash/verify` |
| Session | Stateless JWT in `HttpOnly; SameSite=Lax; Secure (prod)` cookie |
| IP logging | Raw IP stored in `ip_address` (varchar 45, supports IPv6) |
| Custom aliases | Validated against `/^[a-zA-Z0-9_-]+$/` before insert |
| CSRF | SameSite=Lax cookie + HTMX same-origin requests |
| Secrets | All secrets from environment variables validated by `@fastify/env` |
| Admin routes | Protected by `authenticate` preHandler (JWT cookie verification) |

> Generate secure secrets:
> ```bash
> openssl rand -hex 64   # for JWT_SECRET
> openssl rand -hex 64   # for COOKIE_SECRET
> ```

---

## Deployment on LXC / Proxmox

```bash
# 1. Build
bun run build

# 2. Transfer dist/ and .env to the container, then:
NODE_ENV=production bun dist/server.js
```

**Recommended container resources:**

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 1 vCPU | 2 vCPUs |
| RAM | 128 MB | 256 MB (512 MB with Redis co-located) |
| Disk | 256 MB | 512 MB |

For maximum redirect performance, run Redis on the **same LXC container** (`REDIS_HOST=127.0.0.1`).

In production (`NODE_ENV=production`) static assets are served with a **7-day `Cache-Control: max-age`** header.

---
