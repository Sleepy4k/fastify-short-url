import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { urls } from "../../db/schema.ts";

export default fp(
  async function seoRoutes(app: FastifyInstance) {
    app.get("/robots.txt", async (_req, reply) => {
      reply
        .header("Content-Type", "text/plain; charset=utf-8")
        .header("Cache-Control", "public, max-age=86400");
      return [
        "User-agent: *",
        "Disallow: /admin/",
        "Disallow: /login",
        "Disallow: /logout",
        "Allow: /",
        "",
        `Sitemap: ${app.config.BASE_URL}/sitemap.xml`,
        "",
      ].join("\n");
    });

    app.get("/sitemap.xml", async (_req, reply) => {
      const now = new Date();
      const rows = await app.db
        .select({
          shortcode: urls.shortcode,
          updatedAt: urls.updatedAt,
        })
        .from(urls)
        .where(
          and(
            eq(urls.isActive, true),
            or(isNull(urls.expiresAt), gt(urls.expiresAt, now)),
          ),
        )
        .orderBy(desc(urls.totalClicks))
        .limit(5000);

      const base = app.config.BASE_URL.replace(/\/+$/, "");
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      const entries = rows
        .map(
          (r) =>
            `  <url>\n    <loc>${esc(base)}/${esc(r.shortcode)}</loc>\n    <lastmod>${r.updatedAt.toISOString().slice(0, 10)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>`,
        )
        .join("\n");

      reply
        .header("Content-Type", "application/xml; charset=utf-8")
        .header("Cache-Control", "public, max-age=3600");
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        `  <url>\n    <loc>${esc(base)}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
        entries,
        "</urlset>",
      ]
        .filter(Boolean)
        .join("\n");
    });
  },
  { name: "seo-routes", dependencies: ["db-plugin"] },
);
