import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import Redis from "ioredis";

// ── Minimal cache interface — only the methods used across the codebase ───────
// This lets us swap in a no-op driver when Redis is disabled.
export interface CacheClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

// No-op driver — used when REDIS_ENABLED=false
class NullCacheClient implements CacheClient {
  async get(_key: string): Promise<null> {
    return null;
  }
  async setex(_key: string, _ttl: number, _value: string): Promise<"OK"> {
    return "OK";
  }
  async del(_key: string): Promise<0> {
    return 0;
  }
  async quit(): Promise<"OK"> {
    return "OK";
  }
}

declare module "fastify" {
  interface FastifyInstance {
    redis: CacheClient;
  }
}

export default fp(
  async function redisPlugin(app: FastifyInstance) {
    // Set REDIS_ENABLED=false in .env to run without Redis
    const enabled = process.env["REDIS_ENABLED"] !== "false";

    if (!enabled) {
      app.log.warn(
        "⚠️  Redis disabled (REDIS_ENABLED=false) — caching is a no-op.",
      );
      app.decorate("redis", new NullCacheClient() as CacheClient);
      return;
    }

    const redis = new Redis({
      host: process.env["REDIS_HOST"] ?? "127.0.0.1",
      port: Number(process.env["REDIS_PORT"] ?? 6379),
      password: process.env["REDIS_PASSWORD"] || undefined,
      // Disable automatic retries — fail fast on startup, then reconnect on drops
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      // Log but do not crash — ioredis auto-reconnects
      app.log.error({ err }, "Redis error");
    });

    // Eagerly connect and verify the server is reachable before startup continues
    try {
      await redis.connect();
      await redis.ping();
      app.log.info("✅ Redis connected");
    } catch (err) {
      await redis.quit().catch(() => undefined);
      throw new Error(
        `Cannot connect to Redis at ${process.env["REDIS_HOST"] ?? "127.0.0.1"}:${process.env["REDIS_PORT"] ?? 6379}. ` +
          `Set REDIS_ENABLED=false to run without Redis. Cause: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    app.decorate("redis", redis as unknown as CacheClient);

    app.addHook("onClose", async () => {
      await redis.quit();
    });
  },
  { name: "redis-plugin" },
);
