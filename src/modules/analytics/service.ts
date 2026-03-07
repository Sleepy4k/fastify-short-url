import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.ts";
import { clicks, urls } from "../../db/schema.ts";

export async function resetAnalytics(db: DB, urlId: number) {
  const [urlRow] = await db
    .select({ shortcode: urls.shortcode })
    .from(urls)
    .where(eq(urls.id, urlId))
    .limit(1);

  await Promise.all([
    db.delete(clicks).where(eq(clicks.urlId, urlId)),
    db.update(urls).set({ totalClicks: 0 }).where(eq(urls.id, urlId)),
  ]);

  return urlRow?.shortcode;
}
