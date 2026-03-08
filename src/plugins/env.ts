import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import fastifyEnv from "@fastify/env";

declare module "fastify" {
  interface FastifyInstance {
    config: {
      NODE_ENV: string;
      HOST: string;
      PORT: number;
      JWT_SECRET: string;
      COOKIE_SECRET: string;
      DB_HOST: string;
      DB_PORT: number;
      DB_USER: string;
      DB_PASSWORD: string;
      DB_NAME: string;
      REDIS_ENABLED: string;
      REDIS_HOST: string;
      REDIS_PORT: number;
      REDIS_USERNAME: string;
      REDIS_PASSWORD: string;
      REDIS_DB: number;
      REDIS_KEY_PREFIX: string;
      REDIS_TLS: string;
      REDIS_FAMILY: number;
      REDIS_CONNECT_TIMEOUT: number;
      REDIS_COMMAND_TIMEOUT: number;
      REDIS_TTL: number;
      BASE_URL: string;
    };
  }
}

const schema = {
  type: "object",
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    HOST: { type: "string", default: "0.0.0.0" },
    PORT: { type: "number", default: 3000 },
    JWT_SECRET: {
      type: "string",
      default: "fallback-jwt-secret-change-me-in-production",
    },
    COOKIE_SECRET: {
      type: "string",
      default: "fallback-cookie-secret-change-me-in-production",
    },
    DB_HOST: { type: "string", default: "localhost" },
    DB_PORT: { type: "number", default: 3306 },
    DB_USER: { type: "string", default: "root" },
    DB_PASSWORD: { type: "string", default: "" },
    DB_NAME: { type: "string", default: "shorturl" },
    REDIS_ENABLED: { type: "string", default: "false" },
    REDIS_HOST: { type: "string", default: "127.0.0.1" },
    REDIS_PORT: { type: "number", default: 6379 },
    REDIS_USERNAME: { type: "string", default: "" },
    REDIS_PASSWORD: { type: "string", default: "" },
    REDIS_DB: { type: "number", default: 0 },
    REDIS_KEY_PREFIX: { type: "string", default: "" },
    REDIS_TLS: { type: "string", default: "false" },
    REDIS_FAMILY: { type: "number", default: 4 },
    REDIS_CONNECT_TIMEOUT: { type: "number", default: 10000 },
    REDIS_COMMAND_TIMEOUT: { type: "number", default: 5000 },
    REDIS_TTL: { type: "number", default: 3600 },
    BASE_URL: { type: "string", default: "http://localhost:3000" },
  },
} as const;

export default fp(
  async function envPlugin(app: FastifyInstance) {
    await app.register(fastifyEnv, {
      schema,
      dotenv: true,
    });
  },
  { name: "env-plugin" },
);
