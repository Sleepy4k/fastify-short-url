import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import * as ctrl from "./controller.ts";

export default fp(
  async function seoRoutes(app: FastifyInstance) {
    app.get("/robots.txt", (_req, reply) => ctrl.robotsTxt(app, reply));
    app.get("/sitemap.xml", (_req, reply) => ctrl.sitemapXml(app, reply));
  },
  { name: "seo-routes", dependencies: ["db-plugin"] },
);
