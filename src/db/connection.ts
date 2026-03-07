import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schemas/index.ts";

export type DB = MySql2Database<typeof schema>;

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export async function createDbConnection(cfg?: DbConfig): Promise<DB> {
  const pool = mysql.createPool({
    host: cfg?.host ?? process.env["DB_HOST"] ?? "localhost",
    port: cfg?.port ?? Number(process.env["DB_PORT"] ?? 3306),
    user: cfg?.user ?? process.env["DB_USER"] ?? "root",
    password: cfg?.password ?? process.env["DB_PASSWORD"] ?? "",
    database: cfg?.database ?? process.env["DB_NAME"] ?? "shorturl",
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  const conn = await pool.getConnection();
  conn.release();

  return drizzle(pool, { schema, mode: "default" }) as DB;
}
