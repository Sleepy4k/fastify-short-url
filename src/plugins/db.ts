import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { createDbConnection, type DB } from "../db/connection.ts";

declare module "fastify" {
  interface FastifyInstance {
    db: DB;
  }
}

export default fp(
  async function dbPlugin(app: FastifyInstance) {
    const db = await createDbConnection({
      host: app.config.DB_HOST,
      port: app.config.DB_PORT,
      user: app.config.DB_USER,
      password: app.config.DB_PASSWORD,
      database: app.config.DB_NAME,
    });
    app.decorate("db", db);
    app.log.info("\u2705 MySQL connection pool established");
  },
  { name: "db-plugin", dependencies: ["env-plugin"] },
);
