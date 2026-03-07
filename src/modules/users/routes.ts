import type { FastifyInstance } from "fastify";
import * as ctrl from "./controller.ts";

export default async function usersRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.post<{ Body: { username: string; password: string } }>(
    "/admin/users",
    auth,
    (req, reply) => ctrl.createUser(app, req, reply),
  );

  app.delete<{ Params: { id: string } }>(
    "/admin/users/:id",
    auth,
    (req, reply) => ctrl.deleteUser(app, req, reply),
  );
}
