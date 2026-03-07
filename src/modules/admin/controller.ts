import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import ejs from "ejs";
import path from "path";
import * as svc from "./service.ts";

async function renderPartial(
  app: FastifyInstance,
  template: string,
  data: Record<string, unknown>,
): Promise<string> {
  return ejs.renderFile(
    path.join(path.join(app.entryPath, "views"), template),
    { baseUrl: app.config.BASE_URL, ...data },
    { rmWhitespace: true },
  );
}

async function fullPage(
  reply: FastifyReply,
  user: { id: number; username: string; role: string },
  tab: string,
  panelHtml: string,
  siteSettings: Record<string, string>,
) {
  return reply.view("admin/dashboard.ejs", {
    user,
    tab,
    panelHtml,
    appName: siteSettings["app_name"] ?? "ShortURL",
    maintenanceMode: siteSettings["maintenance_mode"] === "true",
    layout: false,
  });
}

export async function linksPage(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const q = req.query as { page?: string; limit?: string };
  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));
  const data = await svc.getLinksData(app.db, page, limit);

  if (req.headers["hx-request"]) {
    reply.header("Cache-Control", "private, max-age=5");
    return reply.view("admin/partials/url-table.ejs", {
      ...data,
      baseUrl: app.config.BASE_URL,
      layout: false,
    });
  }

  const panelHtml = await renderPartial(app, "admin/partials/url-table.ejs", data);
  const siteSettings = await app.getSettings();
  return fullPage(reply, req.user, "links", panelHtml, siteSettings);
}

export async function analyticsPage(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const data = await svc.getAnalyticsOverview(app.db);

  if (req.headers["hx-request"]) {
    reply.header("Cache-Control", "private, max-age=10");
    return reply.view("admin/partials/analytics.ejs", {
      ...data,
      layout: false,
    });
  }

  const panelHtml = await renderPartial(app, "admin/partials/analytics.ejs", data);
  const siteSettings = await app.getSettings();
  return fullPage(reply, req.user, "analytics", panelHtml, siteSettings);
}

export async function analyticsDetailPage(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const urlId = Number(req.params.id);
  const detail = await svc.getAnalyticsDetail(app.db, urlId);
  if (!detail) return reply.status(404).send({ error: "URL not found" });

  reply.header("Cache-Control", "private, max-age=5");

  if (req.headers["hx-request"]) {
    return reply.view("admin/partials/analytics-detail.ejs", {
      ...detail,
      baseUrl: app.config.BASE_URL,
      layout: false,
    });
  }

  const panelHtml = await renderPartial(
    app,
    "admin/partials/analytics-detail.ejs",
    detail,
  );
  const siteSettings = await app.getSettings();
  return fullPage(reply, req.user, "analytics", panelHtml, siteSettings);
}

export async function settingsPage(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const data = await svc.getSettingsData(app.db);

  if (req.headers["hx-request"]) {
    reply.header("Cache-Control", "private, max-age=30");
    return reply.view("admin/partials/settings.ejs", {
      ...data,
      layout: false,
    });
  }

  const panelHtml = await renderPartial(app, "admin/partials/settings.ejs", data);
  const siteSettings = await app.getSettings();
  return fullPage(reply, req.user, "settings", panelHtml, siteSettings);
}

export async function usersPage(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (req.user.role !== "superadmin") {
    if (req.headers["hx-request"]) return reply.status(403).send();
    return reply.redirect("/admin/links");
  }

  const users = await svc.getUsersData(app.db);
  const data = { users, currentUserId: req.user.id, async: true };

  if (req.headers["hx-request"]) {
    return reply.view("admin/partials/users.ejs", {
      ...data,
      layout: false,
      async: true,
    });
  }

  const panelHtml = await renderPartial(app, "admin/partials/users.ejs", data);
  const siteSettings = await app.getSettings();
  return fullPage(reply, req.user, "users", panelHtml, siteSettings);
}
