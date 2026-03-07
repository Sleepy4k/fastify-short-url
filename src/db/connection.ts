import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.ts";

// Use the concrete Drizzle MySQL2 database type
export type DB = MySql2Database<typeof schema>;

export async function createDbConnection(): Promise<DB> {
  const pool = mysql.createPool({
    host: process.env["DB_HOST"] ?? "localhost",
    port: Number(process.env["DB_PORT"] ?? 3306),
    user: process.env["DB_USER"] ?? "root",
    password: process.env["DB_PASSWORD"] ?? "",
    database: process.env["DB_NAME"] ?? "shorturl",
    waitForConnections: true,
    connectionLimit: 20, // Increased from 10 to 20 for better concurrency
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  // Verify connectivity at startup
  const conn = await pool.getConnection();
  conn.release();

  return drizzle(pool, { schema, mode: "default" }) as DB;
}
