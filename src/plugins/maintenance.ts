import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

export default fp(
  async function maintenancePlugin(app: FastifyInstance) {
    app.addHook("onRequest", async (req, reply) => {
      if (
        req.url.startsWith("/admin") ||
        req.url.startsWith("/login") ||
        req.url.startsWith("/logout") ||
        req.url.startsWith("/assets") ||
        req.url.startsWith("/auth")
      )
        return;

      const siteSettings = await app.getSettings();
      if (siteSettings["maintenance_mode"] === "true") {
        return reply.status(503).view("errors/maintenance.ejs", {
          appName: siteSettings["app_name"] ?? "ShortURL",
        });
      }
    });
  },
  {
    name: "maintenance-plugin",
    dependencies: ["settings-plugin"],
  },
);
