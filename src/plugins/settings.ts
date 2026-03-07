import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { settings } from "../db/schema.ts";

declare module "fastify" {
  interface FastifyInstance {
    getSettings: () => Promise<Record<string, string>>;
  }
}

const SETTINGS_CACHE_KEY = "app:settings";
const SETTINGS_CACHE_TTL = 60; // seconds

export default fp(
  async function settingsPlugin(app: FastifyInstance) {
    app.decorate("getSettings", async function getSettings(): Promise<
      Record<string, string>
    > {
      // Try cache first
      const cached = await app.redis.get(SETTINGS_CACHE_KEY);
      if (cached) return JSON.parse(cached) as Record<string, string>;

      // Fallback to DB
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
    // This plugin needs db and redis to be registered first
    dependencies: ["db-plugin", "redis-plugin"],
  },
);
