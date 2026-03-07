import {
  mysqlTable,
  varchar,
  text,
  int,
  boolean,
  datetime,
  timestamp,
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const admins = mysqlTable("admins", {
  id: int("id").primaryKey().autoincrement(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["superadmin", "admin"]).default("admin").notNull(),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow()
    .notNull(),
});

export const urls = mysqlTable(
  "urls",
  {
    id: int("id").primaryKey().autoincrement(),
    shortcode: varchar("shortcode", { length: 32 }).notNull().unique(),
    originalUrl: text("original_url").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: datetime("expires_at"),
    totalClicks: int("total_clicks").default(0).notNull(),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("shortcode_idx").on(table.shortcode),
    index("is_active_idx").on(table.isActive),
  ],
);

export const clicks = mysqlTable(
  "clicks",
  {
    id: int("id").primaryKey().autoincrement(),
    urlId: int("url_id")
      .notNull()
      .references(() => urls.id, { onDelete: "cascade" }),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    referer: varchar("referer", { length: 512 }),
    clickedAt: timestamp("clicked_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("url_id_idx").on(table.urlId),
    index("clicked_at_idx").on(table.clickedAt),
  ],
);

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

// ─── Inferred Types ───────────────────────────────────────────────────────────
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type Url = typeof urls.$inferSelect;
export type NewUrl = typeof urls.$inferInsert;

export type Click = typeof clicks.$inferSelect;
export type NewClick = typeof clicks.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
