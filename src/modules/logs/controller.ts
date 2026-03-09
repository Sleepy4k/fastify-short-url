import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import ejs from "ejs";
import path from "path";
import * as svc from "./service.ts";

export async function logsPage(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const q = req.query as {
    page?: string;
    limit?: string;
    search?: string;
    sort?: string;
  };
  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 10)));
  const search = (q.search ?? "").trim();
  const sort: "asc" | "desc" = q.sort === "asc" ? "asc" : "desc";

  const data = await svc.getLogs(app.db, page, limit, search, sort);

  if (req.headers["hx-request"]) {
    reply.header("Cache-Control", "no-cache");
    return reply.view("pages/dashboard/components/logs.ejs", { ...data, layout: false });
  }

  const panelHtml = await ejs.renderFile(
    path.join(app.entryPath, "views", "pages/dashboard/components/logs.ejs"),
    { ...data },
    { rmWhitespace: true },
  );
  const siteSettings = await app.getSettings();
  return reply.view("pages/dashboard/index.ejs", {
    user: req.user,
    tab: "logs",
    panelHtml,
    appName: siteSettings["app_name"] ?? "ShortURL",
    maintenanceMode: siteSettings["maintenance_mode"] === "true",
    layout: false,
  });
}
