import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, desc, count, sql } from "drizzle-orm";
import ejs from "ejs";
import path from "path";
import { urls, clicks, settings, admins } from "../../db/schema.ts";

const viewsDir = path.join(import.meta.dir, "../../views");
const baseUrl = process.env["BASE_URL"] ?? "http://localhost:3000";

async function renderPartial(
  template: string,
  data: Record<string, unknown>,
): Promise<string> {
  return ejs.renderFile(
    path.join(viewsDir, template),
    { baseUrl, ...data },
    { rmWhitespace: true },
  );
}

async function fullPage(
  reply: FastifyReply,
  user: { id: number; username: string; role: string },
  tab: string,
  panelHtml: string,
  siteSettings: Record<string, string>,
): Promise<unknown> {
  return reply.view("admin/dashboard.ejs", {
    user,
    tab,
    panelHtml,
    appName: siteSettings["app_name"] ?? "ShortURL",
    maintenanceMode: siteSettings["maintenance_mode"] === "true",
    layout: false,
  });
}

export default async function adminRoutes(app: FastifyInstance) {
  const authOpts = { preHandler: [app.authenticate] };

  app.get("/", authOpts, async (_req, reply) => reply.redirect("/admin/links"));
  app.get("/admin/dashboard", authOpts, async (_req, reply) =>
    reply.redirect("/admin/links"),
  );

  app.get(
    "/admin/links",
    authOpts,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = req.query as { page?: string; limit?: string };
      const page = Math.max(1, Number(query.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
      const offset = (page - 1) * limit;

      const [rows, countResult] = await Promise.all([
        app.db
          .select()
          .from(urls)
          .orderBy(desc(urls.createdAt))
          .limit(limit)
          .offset(offset),
        app.db.select({ count: sql<number>`count(*)` }).from(urls),
      ]);
      const total = countResult[0]?.count ?? 0;
      const data = { urls: rows, page, limit, total };

      if (req.headers["hx-request"]) {
        reply.header("Cache-Control", "private, max-age=5");
        return reply.view("admin/partials/url-table.ejs", {
          ...data,
          layout: false,
        });
      }

      const panelHtml = await renderPartial(
        "admin/partials/url-table.ejs",
        data,
      );
      const siteSettings = await app.getSettings();
      return fullPage(reply, req.user, "links", panelHtml, siteSettings);
    },
  );

  app.get(
    "/admin/analytics",
    authOpts,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const [totalUrlsR, totalClicksR, uniqueClicksR] = await Promise.all([
        app.db.select({ count: count() }).from(urls),
        app.db.select({ count: count() }).from(clicks),
        app.db
          .select({ count: sql<number>`COUNT(DISTINCT ip_hash)` })
          .from(clicks)
          .where(sql`ip_hash IS NOT NULL`),
      ]);

      const topUrls = await app.db
        .select({
          id: urls.id,
          shortcode: urls.shortcode,
          originalUrl: urls.originalUrl,
          totalClicks: urls.totalClicks,
          uniqueClicks: count(clicks.id),
        })
        .from(urls)
        .leftJoin(clicks, eq(urls.id, clicks.urlId))
        .groupBy(urls.id)
        .orderBy(desc(urls.totalClicks))
        .limit(10);

      const data = {
        totalUrls: totalUrlsR[0]?.count ?? 0,
        totalClicks: totalClicksR[0]?.count ?? 0,
        uniqueClicks: uniqueClicksR[0]?.count ?? 0,
        topUrls,
      };

      if (req.headers["hx-request"]) {
        reply.header("Cache-Control", "private, max-age=10");
        return reply.view("admin/partials/analytics.ejs", {
          ...data,
          layout: false,
        });
      }

      const panelHtml = await renderPartial(
        "admin/partials/analytics.ejs",
        data,
      );
      const siteSettings = await app.getSettings();
      return fullPage(reply, req.user, "analytics", panelHtml, siteSettings);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/admin/analytics/:id",
    authOpts,
    async (req, reply) => {
      const urlId = Number(req.params.id);
      const [urlRow] = await app.db
        .select()
        .from(urls)
        .where(eq(urls.id, urlId))
        .limit(1);
      if (!urlRow) return reply.status(404).send({ error: "URL not found" });

      const [uniqueClicksR, recentClicks, clicksByDay] = await Promise.all([
        app.db
          .select({ count: sql<number>`COUNT(DISTINCT ip_hash)` })
          .from(clicks)
          .where(eq(clicks.urlId, urlId)),
        app.db
          .select()
          .from(clicks)
          .where(eq(clicks.urlId, urlId))
          .orderBy(desc(clicks.clickedAt))
          .limit(50),
        app.db
          .select({
            day: sql<string>`DATE(clicked_at)`.as("day"),
            count: count(),
          })
          .from(clicks)
          .where(
            sql`url_id = ${urlId} AND clicked_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          )
          .groupBy(sql`DATE(clicked_at)`)
          .orderBy(sql`DATE(clicked_at) ASC`),
      ]);

      reply.header("Cache-Control", "private, max-age=5");
      return reply.view("admin/partials/analytics-detail.ejs", {
        url: urlRow,
        uniqueClicks: uniqueClicksR[0]?.count ?? 0,
        recentClicks,
        clicksByDay,
        layout: false,
      });
    },
  );

  app.get(
    "/admin/settings",
    authOpts,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const rows = await app.db.select().from(settings).orderBy(settings.key);
      const data = { settings: rows };

      if (req.headers["hx-request"]) {
        reply.header("Cache-Control", "private, max-age=30");
        return reply.view("admin/partials/settings.ejs", {
          ...data,
          layout: false,
        });
      }

      const panelHtml = await renderPartial(
        "admin/partials/settings.ejs",
        data,
      );
      const siteSettings = await app.getSettings();
      return fullPage(reply, req.user, "settings", panelHtml, siteSettings);
    },
  );

  app.get(
    "/admin/users",
    authOpts,
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (req.user.role !== "superadmin") {
        if (req.headers["hx-request"]) return reply.status(403).send();
        return reply.redirect("/admin/links");
      }

      const adminUsers = await app.db
        .select({
          id: admins.id,
          username: admins.username,
          role: admins.role,
          createdAt: admins.createdAt,
        })
        .from(admins)
        .orderBy(admins.createdAt);

      const data = { users: adminUsers, currentUserId: req.user.id };

      if (req.headers["hx-request"]) {
        return reply.view("admin/partials/users.ejs", {
          ...data,
          layout: false,
        });
      }

      const panelHtml = await renderPartial("admin/partials/users.ejs", data);
      const siteSettings = await app.getSettings();
      return fullPage(reply, req.user, "users", panelHtml, siteSettings);
    },
  );
}
