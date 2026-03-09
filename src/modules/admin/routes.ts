import type { FastifyInstance } from "fastify";
import * as ctrl from "./controller.ts";
import * as logsCtrl from "../logs/controller.ts";

export default async function adminRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.get("/", auth, (_req, reply) => reply.redirect("/admin/links"));

  app.get("/admin/dashboard", auth, (_req, reply) =>
    reply.redirect("/admin/links"),
  );

  app.get("/admin/links", auth, (req, reply) =>
    ctrl.linksPage(app, req, reply),
  );

  app.get("/admin/analytics", auth, (req, reply) =>
    ctrl.analyticsPage(app, req, reply),
  );

  app.get<{ Params: { id: string } }>(
    "/admin/analytics/:id",
    auth,
    (req, reply) => ctrl.analyticsDetailPage(app, req, reply),
  );

  app.get("/admin/settings", auth, (req, reply) =>
    ctrl.settingsPage(app, req, reply),
  );

  app.get("/admin/users", auth, (req, reply) =>
    ctrl.usersPage(app, req, reply),
  );

  app.get("/admin/logs", auth, (req, reply) =>
    logsCtrl.logsPage(app, req, reply),
  );
}
