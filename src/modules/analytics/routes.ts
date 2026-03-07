import type { FastifyInstance } from "fastify";
import * as ctrl from "./controller.ts";

export default async function analyticsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.delete<{ Params: { id: string } }>(
    "/admin/analytics/:id/reset",
    auth,
    (req, reply) => ctrl.resetAnalytics(app, req, reply),
  );
}
