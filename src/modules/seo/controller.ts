import type { FastifyInstance, FastifyReply } from "fastify";
import * as svc from "./service.ts";

export async function robotsTxt(
  app: FastifyInstance,
  reply: FastifyReply,
): Promise<string> {
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
}

export async function sitemapXml(
  app: FastifyInstance,
  reply: FastifyReply,
): Promise<string> {
  const rows = await svc.getActiveUrls(app.db);
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
    `  <url>\n    <loc>${esc(base)}/login</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    entries,
    "</urlset>",
  ]
    .filter(Boolean)
    .join("\n");
}
