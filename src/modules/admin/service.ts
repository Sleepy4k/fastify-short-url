import { eq, desc, count, sql } from "drizzle-orm";
import type { DB } from "../../db/connection.ts";
import { urls, clicks, settings, admins } from "../../db/schema.ts";

export async function getLinksData(db: DB, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(urls)
      .orderBy(desc(urls.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(urls),
  ]);
  return { urls: rows, page, limit, total: Number(countResult[0]?.count ?? 0) };
}

export async function getAnalyticsOverview(db: DB) {
  const [totalUrlsR, totalClicksR, uniqueClicksR] = await Promise.all([
    db.select({ count: count() }).from(urls),
    db.select({ count: count() }).from(clicks),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ip_hash)` })
      .from(clicks)
      .where(sql`ip_hash IS NOT NULL`),
  ]);

  const topUrls = await db
    .select({
      id: urls.id,
      shortcode: urls.shortcode,
      originalUrl: urls.originalUrl,
      totalClicks: urls.totalClicks,
      uniqueClicks: count(clicks.id),
    })
    .from(urls)
    .leftJoin(clicks, eq(urls.id, clicks.urlId))
    .groupBy(urls.id)
    .orderBy(desc(urls.totalClicks))
    .limit(10);

  return {
    totalUrls: Number(totalUrlsR[0]?.count ?? 0),
    totalClicks: Number(totalClicksR[0]?.count ?? 0),
    uniqueClicks: Number(uniqueClicksR[0]?.count ?? 0),
    topUrls,
  };
}

export async function getAnalyticsDetail(db: DB, urlId: number) {
  const [urlRow] = await db
    .select()
    .from(urls)
    .where(eq(urls.id, urlId))
    .limit(1);
  if (!urlRow) return null;

  const [uniqueClicksR, recentClicks, clicksByDay] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(DISTINCT ip_hash)` })
      .from(clicks)
      .where(eq(clicks.urlId, urlId)),
    db
      .select()
      .from(clicks)
      .where(eq(clicks.urlId, urlId))
      .orderBy(desc(clicks.clickedAt))
      .limit(50),
    db
      .select({
        day: sql<string>`DATE(clicked_at)`.as("day"),
        count: count(),
      })
      .from(clicks)
      .where(
        sql`url_id = ${urlId} AND clicked_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      )
      .groupBy(sql`DATE(clicked_at)`)
      .orderBy(sql`DATE(clicked_at) ASC`),
  ]);

  return {
    url: urlRow,
    uniqueClicks: Number(uniqueClicksR[0]?.count ?? 0),
    recentClicks,
    clicksByDay,
  };
}

export async function getSettingsData(db: DB) {
  const rows = await db.select().from(settings).orderBy(settings.key);
  return { settings: rows };
}

export async function getUsersData(db: DB) {
  const adminUsers = await db
    .select({
      id: admins.id,
      username: admins.username,
      role: admins.role,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .orderBy(admins.createdAt);
  return adminUsers;
}
