import type { FastifyInstance } from "fastify";
import * as ctrl from "./controller.ts";

export default async function authRoutes(app: FastifyInstance) {
  app.get("/login", (req, reply) => ctrl.loginPage(app, req, reply));

  app.post<{ Body: { username: string; password: string } }>(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 1, maxLength: 64 },
            password: { type: "string", minLength: 1, maxLength: 128 },
          },
        },
      },
    },
    (req, reply) => ctrl.handleLogin(app, req, reply),
  );

  app.post("/logout", (req, reply) => ctrl.handleLogout(app, req, reply));
}
