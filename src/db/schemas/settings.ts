import {
  mysqlTable,
  varchar,
  text,
  int,
  timestamp,
  mysqlEnum,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const settings = mysqlTable("settings", {
  id: int("id").primaryKey().autoincrement(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value").notNull(),
  type: mysqlEnum("type", ["string", "boolean", "number", "json"])
    .default("string")
    .notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow()
    .notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
