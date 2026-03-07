import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.ts";
import type { CacheClient } from "../../plugins/redis.ts";
import { settings } from "../../db/schema.ts";

const SETTINGS_CACHE_KEY = "app:settings";

export async function updateSetting(
  db: DB,
  redis: CacheClient,
  key: string,
  value: string,
) {
  await db.update(settings).set({ value }).where(eq(settings.key, key));
  await redis.del(SETTINGS_CACHE_KEY);

  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return row ?? null;
}
