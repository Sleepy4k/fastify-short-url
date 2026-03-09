import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import type { DB } from "../../db/connection.ts";
import { urls } from "../../db/schema.ts";

export async function getActiveUrls(db: DB) {
  const now = new Date();
  return db
    .select({ shortcode: urls.shortcode, updatedAt: urls.updatedAt })
    .from(urls)
    .where(
      and(
        eq(urls.isActive, true),
        or(isNull(urls.expiresAt), gt(urls.expiresAt, now)),
      ),
    )
    .orderBy(desc(urls.totalClicks))
    .limit(5000);
}
