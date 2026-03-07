import {
  mysqlTable,
  varchar,
  text,
  int,
  boolean,
  datetime,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

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

export type Url = typeof urls.$inferSelect;
export type NewUrl = typeof urls.$inferInsert;
