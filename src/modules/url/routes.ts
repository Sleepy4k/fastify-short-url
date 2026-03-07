import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import { createHash } from "crypto";
import { urls, clicks } from "../../db/schema.ts";

const CACHE_PREFIX = "url:";
const CACHE_TTL = Number(process.env["REDIS_TTL"] ?? 3600);

interface CreateBody {
  originalUrl: string;
  customAlias?: string;
  expiresAt?: string;
}

interface UpdateBody {
  originalUrl?: string;
  shortcode?: string;
  isActive?: boolean;
  expiresAt?: string;
}

export default async function urlRoutes(app: FastifyInstance) {
  // ── Public Redirect (cache-first) ──────────────────────────────────────────
  app.get<{ Params: { code: string } }>("/:code", async (req, reply) => {
    const { code } = req.params;

    // 1. Cache lookup
    const cached = await app.redis.get(`${CACHE_PREFIX}${code}`);
    if (cached) {
      // Fire-and-forget click analytics — does NOT block redirect
      app.log.info({ code }, "cache hit");
      setImmediate(() => void recordClick(app, code, req));

      // Set cache headers for browser caching (1 hour)
      return reply
        .status(301)
        .header("Cache-Control", "public, max-age=3600")
        .header("ETag", code)
        .redirect(cached);
    }

    // 2. DB lookup
    const [row] = await app.db
      .select()
      .from(urls)
      .where(eq(urls.shortcode, code))
      .limit(1);

    if (!row || !row.isActive) {
      return reply.status(404).view("errors/404.ejs", { layout: false });
    }

    // Check expiry
    if (row.expiresAt && row.expiresAt < new Date()) {
      return reply.status(410).view("errors/expired.ejs", { layout: false });
    }

    // 3. Populate cache & redirect
    await app.redis.setex(`${CACHE_PREFIX}${code}`, CACHE_TTL, row.originalUrl);
    setImmediate(() => void recordClick(app, code, req));

    // Set cache headers for browser caching
    return reply
      .status(301)
      .header("Cache-Control", "public, max-age=3600")
      .header("ETag", code)
      .redirect(row.originalUrl);
  });

  // ── Protected Admin Routes ─────────────────────────────────────────────────
  const adminOpts = { preHandler: [app.authenticate] };

  // GET /urls — paginated list (HTMX partial)
  app.get(
    "/admin/urls",
    adminOpts,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = req.query as {
        page?: string;
        limit?: string;
        search?: string;
      };
      const page = Math.max(1, Number(query.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
      const offset = (page - 1) * limit;

      const rows = await app.db
        .select()
        .from(urls)
        .orderBy(desc(urls.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await app.db
        .select({ count: sql<number>`count(*)` })
        .from(urls);
      const total = countResult[0]?.count ?? 0;

      // Cache this response for 5 seconds
      reply.header("Cache-Control", "private, max-age=5");

      return reply.view("admin/partials/url-table.ejs", {
        urls: rows,
        page,
        limit,
        total,
        baseUrl: process.env["BASE_URL"] ?? "",
        layout: false,
      });
    },
  );

  // POST /admin/urls — create new shortlink
  app.post<{ Body: CreateBody }>(
    "/admin/urls",
    adminOpts,
    async (req, reply) => {
      const { originalUrl, customAlias, expiresAt } = req.body;
      const shortcode = customAlias?.trim() || nanoid(7);

      // Validate custom alias (alphanumeric + hyphen/underscore only)
      if (customAlias && !/^[a-zA-Z0-9_-]+$/.test(customAlias)) {
        return reply
          .status(400)
          .header("HX-Retarget", "#create-error")
          .view("admin/partials/form-error.ejs", {
            error: "Alias may only contain letters, numbers, - and _.",
            layout: false,
          });
      }

      try {
        await app.db.insert(urls).values({
          shortcode,
          originalUrl,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          isActive: true,
        });
      } catch (err: unknown) {
        const isDuplicate =
          err instanceof Error && err.message.includes("Duplicate entry");
        const msg = isDuplicate
          ? "That alias is already taken. Choose another."
          : "Could not create shortlink.";
        return reply
          .status(400)
          .header("HX-Retarget", "#create-error")
          .view("admin/partials/form-error.ejs", { error: msg, layout: false });
      }

      // Return refreshed URL table partial for HTMX swap
      return reply.header("HX-Trigger", "urlCreated").status(201).send();
    },
  );

  // PATCH /admin/urls/:id — edit destination / toggle active / change shortcode
  app.patch<{ Params: { id: string }; Body: UpdateBody }>(
    "/admin/urls/:id",
    adminOpts,
    async (req, reply) => {
      const id = Number(req.params.id);
      const { originalUrl, shortcode, isActive, expiresAt } = req.body;

      // If shortcode is being changed, validate it
      if (shortcode !== undefined) {
        if (!/^[a-zA-Z0-9_-]+$/.test(shortcode)) {
          return reply
            .status(400)
            .header("HX-Retarget", "#edit-error")
            .view("admin/partials/form-error.ejs", {
              error: "Shortcode may only contain letters, numbers, - and _.",
              layout: false,
            });
        }

        // Check if shortcode is already taken
        const [existing] = await app.db
          .select()
          .from(urls)
          .where(eq(urls.shortcode, shortcode))
          .limit(1);

        if (existing && existing.id !== id) {
          return reply
            .status(400)
            .header("HX-Retarget", "#edit-error")
            .view("admin/partials/form-error.ejs", {
              error: "That shortcode is already taken. Choose another.",
              layout: false,
            });
        }
      }

      const update: Partial<typeof urls.$inferInsert> = {};
      if (originalUrl !== undefined) update.originalUrl = originalUrl;
      if (shortcode !== undefined) update.shortcode = shortcode;
      if (isActive !== undefined) update.isActive = isActive;
      if (expiresAt !== undefined)
        update.expiresAt = expiresAt ? new Date(expiresAt) : null;

      await app.db.update(urls).set(update).where(eq(urls.id, id));

      // Invalidate cache for old shortcode
      const [row] = await app.db
        .select({ shortcode: urls.shortcode })
        .from(urls)
        .where(eq(urls.id, id))
        .limit(1);
      if (row && shortcode !== undefined)
        await app.redis.del(`${CACHE_PREFIX}${shortcode}`);

      return reply.header("HX-Trigger", "urlUpdated").status(200).send();
    },
  );

  // DELETE /admin/urls/:id
  app.delete<{ Params: { id: string } }>(
    "/admin/urls/:id",
    adminOpts,
    async (req, reply) => {
      const id = Number(req.params.id);

      const [row] = await app.db
        .select({ shortcode: urls.shortcode })
        .from(urls)
        .where(eq(urls.id, id))
        .limit(1);

      await app.db.delete(urls).where(eq(urls.id, id));
      if (row) await app.redis.del(`${CACHE_PREFIX}${row.shortcode}`);

      return reply.header("HX-Trigger", "urlDeleted").status(200).send();
    },
  );

  // GET /admin/urls/:id/qr — generate QR code as base64 PNG
  app.get<{ Params: { id: string } }>(
    "/admin/urls/:id/qr",
    adminOpts,
    async (req, reply) => {
      const id = Number(req.params.id);
      const [row] = await app.db
        .select({ shortcode: urls.shortcode })
        .from(urls)
        .where(eq(urls.id, id))
        .limit(1);

      if (!row) return reply.status(404).send({ error: "Not found" });

      const shortUrl = `${process.env["BASE_URL"] ?? ""}/${row.shortcode}`;
      const qrDataUrl = await QRCode.toDataURL(shortUrl, {
        width: 300,
        margin: 2,
      });

      // Cache this QR code for 1 hour since it doesn't change
      reply.header("Cache-Control", "private, max-age=3600");

      return reply.view("admin/partials/qr-modal.ejs", {
        qrDataUrl,
        shortUrl,
        layout: false,
      });
    },
  );

  // GET /admin/urls/:id/edit — show edit modal
  app.get<{ Params: { id: string } }>(
    "/admin/urls/:id/edit",
    adminOpts,
    async (req, reply) => {
      const id = Number(req.params.id);
      const [row] = await app.db
        .select()
        .from(urls)
        .where(eq(urls.id, id))
        .limit(1);

      if (!row) return reply.status(404).send({ error: "Not found" });

      return reply.view("admin/partials/edit-modal.ejs", {
        url: row,
        layout: false,
      });
    },
  );
}

// async click recorder
async function recordClick(
  app: FastifyInstance,
  code: string,
  req: FastifyRequest,
) {
  try {
    const [row] = await app.db
      .select({ id: urls.id })
      .from(urls)
      .where(eq(urls.shortcode, code))
      .limit(1);

    if (!row) return;

    const rawIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";

    const ipHash = createHash("sha256").update(rawIp).digest("hex");
    const userAgent = (req.headers["user-agent"] ?? "").slice(0, 512);
    const referer = (req.headers["referer"] ?? "").slice(0, 512);

    await Promise.all([
      app.db
        .insert(clicks)
        .values({ urlId: row.id, ipHash, userAgent, referer }),
      app.db
        .update(urls)
        .set({ totalClicks: sql`${urls.totalClicks} + 1` })
        .where(eq(urls.id, row.id)),
    ]);
  } catch (err) {
    app.log.error({ err }, "Failed to record click");
  }
}
