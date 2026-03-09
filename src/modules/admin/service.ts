import { eq, desc, asc, count, sql, or, like } from "drizzle-orm";
import type { DB } from "../../db/connection.ts";
import { urls, clicks, settings, admins } from "../../db/schema.ts";

export async function getLinksData(
  db: DB,
  page: number,
  limit: number,
  search = "",
  sort = "createdAt:desc",
) {
  const offset = (page - 1) * limit;
  const s = search.trim();
  const searchCond = s
    ? or(like(urls.shortcode, `%${s}%`), like(urls.originalUrl, `%${s}%`))
    : undefined;
  const [sf, sd] = sort.split(":");
  const orderCol =
    sf === "clicks"
      ? sd === "asc" ? asc(urls.totalClicks) : desc(urls.totalClicks)
      : sf === "shortcode"
        ? sd === "asc" ? asc(urls.shortcode) : desc(urls.shortcode)
        : sf === "expiresAt"
          ? sd === "asc" ? asc(urls.expiresAt) : desc(urls.expiresAt)
          : sd === "asc" ? asc(urls.createdAt) : desc(urls.createdAt);
  const [rows, countResult] = await Promise.all([
    db.select().from(urls).where(searchCond).orderBy(orderCol).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(urls).where(searchCond),
  ]);
  return { urls: rows, page, limit, total: Number(countResult[0]?.count ?? 0), search, sort };
}

export async function getAnalyticsOverview(db: DB) {
  const [totalUrlsR, totalClicksR, uniqueClicksR] = await Promise.all([
    db.select({ count: count() }).from(urls),
    db.select({ count: count() }).from(clicks),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ip_address)` })
      .from(clicks)
      .where(sql`ip_address IS NOT NULL`),
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

export async function getAnalyticsDetail(
  db: DB,
  urlId: number,
  clicksPage = 1,
  clicksLimit = 10,
) {
  const [urlRow] = await db
    .select()
    .from(urls)
    .where(eq(urls.id, urlId))
    .limit(1);
  if (!urlRow) return null;

  const clicksOffset = (clicksPage - 1) * clicksLimit;
  const [uniqueClicksR, recentClicks, clicksByDay, totalClicksCount] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(DISTINCT ip_address)` })
      .from(clicks)
      .where(eq(clicks.urlId, urlId)),
    db
      .select()
      .from(clicks)
      .where(eq(clicks.urlId, urlId))
      .orderBy(desc(clicks.clickedAt))
      .limit(clicksLimit)
      .offset(clicksOffset),
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
    db.select({ count: sql<number>`count(*)` }).from(clicks).where(eq(clicks.urlId, urlId)),
  ]);

  return {
    url: urlRow,
    uniqueClicks: Number(uniqueClicksR[0]?.count ?? 0),
    recentClicks,
    clicksByDay,
    clicksPage,
    clicksLimit,
    totalClicks: Number(totalClicksCount[0]?.count ?? 0),
  };
}

export async function getSettingsData(db: DB) {
  const rows = await db.select().from(settings).orderBy(settings.key);
  return { settings: rows };
}

export async function getUsersData(
  db: DB,
  page = 1,
  limit = 10,
  search = "",
  sort = "createdAt:asc",
) {
  const offset = (page - 1) * limit;
  const s = search.trim();
  const searchCond = s ? like(admins.username, `%${s}%`) : undefined;
  const [sf, sd] = sort.split(":");
  const orderCol =
    sf === "username"
      ? sd === "asc" ? asc(admins.username) : desc(admins.username)
      : sf === "role"
        ? sd === "asc" ? asc(admins.role) : desc(admins.role)
        : sd === "asc" ? asc(admins.createdAt) : desc(admins.createdAt);
  const [adminUsers, countResult] = await Promise.all([
    db
      .select({ id: admins.id, username: admins.username, role: admins.role, createdAt: admins.createdAt })
      .from(admins)
      .where(searchCond)
      .orderBy(orderCol)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(admins).where(searchCond),
  ]);
  return { users: adminUsers, total: Number(countResult[0]?.count ?? 0), page, limit, search, sort };
}
