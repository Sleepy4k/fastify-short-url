import type { FastifyInstance } from "fastify";
import * as ctrl from "./controller.ts";
import type { UpdatePasswordDto } from "../../types/index.ts";

export default async function profileRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.get("/admin/profile", auth, (req, reply) =>
    ctrl.profilePage(app, req, reply),
  );

  app.patch<{ Body: UpdatePasswordDto }>(
    "/admin/profile/password",
    {
      ...auth,
      schema: {
        body: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", minLength: 1, maxLength: 128 },
            newPassword: { type: "string", minLength: 6, maxLength: 128 },
          },
        },
      },
    },
    (req, reply) => ctrl.updatePassword(app, req, reply),
  );
}
