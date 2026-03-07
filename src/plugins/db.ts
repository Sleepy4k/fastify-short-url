import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { createDbConnection, type DB } from "../db/connection.ts";

// Extend FastifyInstance type with our decorator
declare module "fastify" {
  interface FastifyInstance {
    db: DB;
  }
}

export default fp(
  async function dbPlugin(app: FastifyInstance) {
    const db = await createDbConnection();
    app.decorate("db", db);
    app.log.info("✅ MySQL connection pool established");
  },
  { name: "db-plugin" },
);
