import type { FastifyInstance } from "fastify";
import * as ctrl from "./controller.ts";

export default async function settingsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.patch<{ Params: { key: string }; Body: { value: string } }>(
    "/admin/settings/:key",
    auth,
    (req, reply) => ctrl.updateSetting(app, req, reply),
  );
}
