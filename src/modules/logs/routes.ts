import type { FastifyInstance } from "fastify";
import * as ctrl from "./controller.ts";

export default async function logsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.get("/admin/logs", auth, (req, reply) =>
    ctrl.logsPage(app, req, reply),
  );
}
