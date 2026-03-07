import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { settings } from "../db/schema.ts";

declare module "fastify" {
  interface FastifyInstance {
    getSettings: () => Promise<Record<string, string>>;
  }
}

const SETTINGS_CACHE_KEY = "app:settings";
const SETTINGS_CACHE_TTL = 60 * 60 * 24 * 30;

export default fp(
  async function settingsPlugin(app: FastifyInstance) {
    app.decorate("getSettings", async function getSettings(): Promise<
      Record<string, string>
    > {
      const cached = await app.redis.get(SETTINGS_CACHE_KEY);
      if (cached) return JSON.parse(cached) as Record<string, string>;

      const rows = await app.db.select().from(settings);
      const map: Record<string, string> = {};
      for (const row of rows) map[row.key] = row.value;

      await app.redis.setex(
        SETTINGS_CACHE_KEY,
        SETTINGS_CACHE_TTL,
        JSON.stringify(map),
      );
      return map;
    });
  },
  {
    name: "settings-plugin",
    dependencies: ["db-plugin", "redis-plugin"],
  },
);
