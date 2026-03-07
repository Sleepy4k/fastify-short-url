import Fastify from "fastify";
import fastifySensible from "@fastify/sensible";
import fastifyFormbody from "@fastify/formbody";

import dbPlugin from "./plugins/db.ts";
import redisPlugin from "./plugins/redis.ts";
import authPlugin from "./plugins/auth.ts";
import viewPlugin from "./plugins/view.ts";
import settingsPlugin from "./plugins/settings.ts";
import maintenancePlugin from "./plugins/maintenance.ts";
import staticPlugin from "./plugins/static.ts";

import authRoutes from "./modules/auth/routes.ts";
import urlRoutes from "./modules/url/routes.ts";
import analyticsRoutes from "./modules/analytics/routes.ts";
import settingsRoutes from "./modules/settings/routes.ts";
import usersRoutes from "./modules/users/routes.ts";
import adminRoutes from "./modules/admin/routes.ts";

const app = Fastify({
  logger: {
    level: process.env["NODE_ENV"] === "production" ? "warn" : "info",
    transport:
      process.env["NODE_ENV"] !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
  trustProxy: true,
});

await app.register(dbPlugin);
await app.register(redisPlugin);
await app.register(fastifySensible);
await app.register(fastifyFormbody);
await app.register(authPlugin);
await app.register(viewPlugin);
await app.register(staticPlugin);
await app.register(settingsPlugin);
await app.register(maintenancePlugin);

await app.register(authRoutes);
await app.register(urlRoutes);
await app.register(analyticsRoutes);
await app.register(settingsRoutes);
await app.register(usersRoutes);
await app.register(adminRoutes);

app.setErrorHandler(
  async (error: Error & { statusCode?: number }, _req, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    const message = error.message ?? "An unexpected error occurred";
    if (reply.request.headers["hx-request"]) {
      return reply
        .status(statusCode)
        .header("HX-Retarget", "#global-error")
        .send(`<p class="text-red-500">${message}</p>`);
    }
    return reply.status(statusCode).view("errors/error.ejs", {
      statusCode,
      message,
      layout: false,
    });
  },
);

app.setNotFoundHandler(async (_req, reply) => {
  return reply.status(404).view("errors/404.ejs", { layout: false });
});

const host = process.env["HOST"] ?? "0.0.0.0";
const port = Number(process.env["PORT"] ?? 3000);

try {
  await app.listen({ host, port });
  console.log(`Server running at http://${host}:${port}`);
} catch (err) {
  app.log.fatal(err, "Server failed to start");
  process.exit(1);
}
