import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import Redis from "ioredis";

export interface CacheClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

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
    const enabled = app.config.REDIS_ENABLED !== "false";

    if (!enabled) {
      app.log.warn(
        "⚠️  Redis disabled (REDIS_ENABLED=false) — caching is a no-op.",
      );
      app.decorate("redis", new NullCacheClient() as CacheClient);
      return;
    }

    const redis = new Redis({
      host: app.config.REDIS_HOST,
      port: app.config.REDIS_PORT,
      password: app.config.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      app.log.error({ err }, "Redis error");
    });

    try {
      await redis.connect();
      await redis.ping();
      app.log.info("✅ Redis connected");
    } catch (err) {
      await redis.quit().catch(() => undefined);
      throw new Error(
        `Cannot connect to Redis at ${app.config.REDIS_HOST}:${app.config.REDIS_PORT}. ` +
          `Set REDIS_ENABLED=false to run without Redis. Cause: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    app.decorate("redis", redis as unknown as CacheClient);

    app.addHook("onClose", async () => {
      await redis.quit();
    });
  },
  { name: "redis-plugin", dependencies: ["env-plugin"] },
);
