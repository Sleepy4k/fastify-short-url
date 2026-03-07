import type { FastifyInstance } from "fastify";
import * as ctrl from "./controller.ts";

export default async function urlRoutes(app: FastifyInstance) {
  app.get<{ Params: { code: string } }>("/:code", (req, reply) =>
    ctrl.handleRedirect(app, req, reply),
  );

  const auth = { preHandler: [app.authenticate] };

  app.get("/admin/urls", auth, (req, reply) => ctrl.listUrls(app, req, reply));

  app.post<{
    Body: { originalUrl: string; customAlias?: string; expiresAt?: string };
  }>("/admin/urls", auth, (req, reply) => ctrl.createUrl(app, req, reply));

  app.patch<{
    Params: { id: string };
    Body: {
      originalUrl?: string;
      shortcode?: string;
      isActive?: string | boolean;
      expiresAt?: string;
    };
  }>("/admin/urls/:id", auth, (req, reply) => ctrl.updateUrl(app, req, reply));

  app.delete<{ Params: { id: string } }>(
    "/admin/urls/:id",
    auth,
    (req, reply) => ctrl.deleteUrl(app, req, reply),
  );

  app.get<{ Params: { id: string } }>(
    "/admin/urls/:id/qr",
    auth,
    (req, reply) => ctrl.getQrCode(app, req, reply),
  );

  app.get<{ Params: { id: string } }>(
    "/admin/urls/:id/edit",
    auth,
    (req, reply) => ctrl.getEditModal(app, req, reply),
  );
}
